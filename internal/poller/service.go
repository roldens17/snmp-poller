package poller

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/rs/zerolog/log"

	"github.com/fresatu/snmp-poller/internal/config"
	"github.com/fresatu/snmp-poller/internal/snmpclient"
	"github.com/fresatu/snmp-poller/internal/store"
)

const defaultOrgID = 1

// Service executes periodic SNMP polls.
type Service struct {
	cfg     *config.Config
	store   *store.Store
	jobs    chan config.Switch
	metrics *pollerMetrics
}

// NewService builds a poller Service.
func NewService(cfg *config.Config, db *store.Store) *Service {
	m := newPollerMetrics(cfg.Metrics.Enabled)
	return &Service{
		cfg:     cfg,
		store:   db,
		jobs:    make(chan config.Switch, cfg.WorkerCount*2+1),
		metrics: m,
	}
}

// Run spins up workers and schedules polls until ctx done.
func (s *Service) Run(ctx context.Context) {
	var wg sync.WaitGroup
	for i := 0; i < s.cfg.WorkerCount; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			s.worker(ctx, workerID)
		}(i)
	}

	if s.cfg.Discovery.Enabled {
		go s.discoveryLoop(ctx)
	}

	s.enqueueDevices(ctx)
	ticker := time.NewTicker(s.cfg.PollInterval.Duration)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			close(s.jobs)
			wg.Wait()
			return
		case <-ticker.C:
			s.enqueueDevices(ctx)
		}
	}
}

func (s *Service) enqueueDevices(ctx context.Context) {
	for _, sw := range s.cfg.Switches {
		if !sw.EnabledValue() {
			continue
		}
		select {
		case <-ctx.Done():
			return
		case s.jobs <- sw:
		}
	}
}

func (s *Service) worker(ctx context.Context, id int) {
	logger := log.With().Str("component", "poller").Int("worker", id).Logger()
	for {
		select {
		case <-ctx.Done():
			return
		case sw, ok := <-s.jobs:
			if !ok {
				return
			}
			start := time.Now()
			err := s.pollDevice(ctx, sw)
			if err != nil {
				logger.Warn().Err(err).Str("device", sw.Name).Msg("poll failed")
				s.metrics.observeError(sw.Name)
			} else {
				s.metrics.observeDuration(sw.Name, time.Since(start))
			}
			s.metrics.setLastStatus(sw.Name, err == nil)
		}
	}
}

func (s *Service) pollDevice(ctx context.Context, sw config.Switch) error {
	logger := log.With().Str("device", sw.Name).Str("ip", sw.Address).Logger()
	ctx, cancel := context.WithTimeout(ctx, sw.Timeout.Duration+time.Second)
	defer cancel()

	ifaces, err := snmpclient.PollInterfaces(ctx, sw)
	if err != nil {
		return fmt.Errorf("interfaces: %w", err)
	}
	macs, err := snmpclient.PollMACTable(ctx, sw)
	if err != nil {
		logger.Warn().Err(err).Msg("mac table poll failed")
	}

	pollTime := time.Now().UTC()
	device := &store.Device{
		OrgID:       defaultOrgID,
		Hostname:    sw.Name,
		MgmtIP:      sw.Address,
		Community:   sw.Community,
		Enabled:     sw.EnabledValue(),
		Site:        sw.Site,
		Description: sw.Description,
		LastSeen:    pollTime,
	}
	deviceID, err := s.store.UpsertDevice(ctx, device)
	if err != nil {
		return err
	}

	prevStates, err := s.store.GetInterfaceStates(ctx, defaultOrgID, deviceID)
	if err != nil {
		logger.Warn().Err(err).Msg("load previous interface state")
		prevStates = map[int]store.InterfaceState{}
	}

	prevCounters, err := s.store.LatestInterfaceCounters(ctx, defaultOrgID, deviceID)
	if err != nil {
		logger.Warn().Err(err).Msg("load previous counters")
		prevCounters = map[int]store.InterfaceCounters{}
	}

	states := make([]store.InterfaceState, 0, len(ifaces))
	counters := make([]store.InterfaceCounters, 0, len(ifaces))
	keep := make([]int, 0, len(ifaces))
	for _, metric := range ifaces {
		prev, hasPrev := prevStates[metric.Index]
		statusChanged := pollTime
		if hasPrev && prev.OperStatus == metric.Oper {
			statusChanged = prev.StatusChangedAt
		}
		state := store.InterfaceState{
			DeviceID:        deviceID,
			IfIndex:         metric.Index,
			IfName:          metric.Name,
			IfDescr:         metric.Descr,
			AdminStatus:     metric.Admin,
			OperStatus:      metric.Oper,
			Speed:           metric.Speed,
			InOctets:        metric.InOctets,
			OutOctets:       metric.OutOctets,
			InErrors:        metric.InErrors,
			OutErrors:       metric.OutErrors,
			StatusChangedAt: statusChanged,
			UpdatedAt:       pollTime,
		}
		states = append(states, state)
		counters = append(counters, store.InterfaceCounters{
			DeviceID:    deviceID,
			IfIndex:     metric.Index,
			InOctets:    metric.InOctets,
			OutOctets:   metric.OutOctets,
			InErrors:    metric.InErrors,
			OutErrors:   metric.OutErrors,
			CollectedAt: pollTime,
		})
		keep = append(keep, metric.Index)
	}

	if err := s.store.UpsertInterfaces(ctx, deviceID, states); err != nil {
		return err
	}
	if err := s.store.PruneInterfaces(ctx, deviceID, keep); err != nil {
		logger.Warn().Err(err).Msg("prune interfaces")
	}
	if err := s.store.InsertInterfaceCounters(ctx, counters); err != nil {
		logger.Warn().Err(err).Msg("insert counters")
	}

	macEntries := make([]store.MACEntry, 0, len(macs))
	for _, entry := range macs {
		idx := entry.IfIndex
		macEntries = append(macEntries, store.MACEntry{
			DeviceID:  deviceID,
			VLAN:      entry.VLAN,
			MAC:       entry.MAC,
			IfIndex:   &idx,
			FirstSeen: pollTime,
			LastSeen:  pollTime,
		})
	}
	if err := s.store.UpsertMacEntries(ctx, macEntries); err != nil {
		logger.Warn().Err(err).Msg("mac table upsert")
	}
	s.evaluateAlerts(ctx, defaultOrgID, deviceID, pollTime, ifaces, prevStates, prevCounters)
	return nil
}

// pollerMetrics wraps Prometheus observers.
type pollerMetrics struct {
	pollDuration prometheus.ObserverVec
	pollErrors   *prometheus.CounterVec
	lastStatus   *prometheus.GaugeVec
}

func newPollerMetrics(enabled bool) *pollerMetrics {
	if !enabled {
		return &pollerMetrics{}
	}
	return &pollerMetrics{
		pollDuration: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "snmp_poller_duration_seconds",
			Help:    "Duration of SNMP polls",
			Buckets: []float64{0.2, 0.5, 1, 2, 5, 10, 20},
		}, []string{"device"}),
		pollErrors: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "snmp_poller_errors_total",
			Help: "Total poll errors per device",
		}, []string{"device"}),
		lastStatus: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "snmp_poller_last_success",
			Help: "1 if last poll succeeded",
		}, []string{"device"}),
	}
}

func (m *pollerMetrics) observeDuration(device string, d time.Duration) {
	if m == nil || m.pollDuration == nil {
		return
	}
	m.pollDuration.WithLabelValues(device).Observe(d.Seconds())
}

func (m *pollerMetrics) observeError(device string) {
	if m == nil || m.pollErrors == nil {
		return
	}
	m.pollErrors.WithLabelValues(device).Inc()
}

func (m *pollerMetrics) setLastStatus(device string, ok bool) {
	if m == nil || m.lastStatus == nil {
		return
	}
	var val float64
	if ok {
		val = 1
	}
	m.lastStatus.WithLabelValues(device).Set(val)
}
