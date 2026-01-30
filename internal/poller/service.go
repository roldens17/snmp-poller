package poller

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/rs/zerolog/log"

	"github.com/fresatu/snmp-poller/internal/config"
	"github.com/fresatu/snmp-poller/internal/devicereg"
	"github.com/fresatu/snmp-poller/internal/notification"
	"github.com/fresatu/snmp-poller/internal/security"
	"github.com/fresatu/snmp-poller/internal/snmpclient"
	"github.com/fresatu/snmp-poller/internal/store"
)

// Service executes periodic SNMP polls.
type Service struct {
	cfg             *config.Config
	store           *store.Store
	notifier        *notification.Service
	jobs            chan config.Switch
	metrics         *pollerMetrics
	defaultTenantID string
	encryptor       *security.Encryptor
}

// NewService builds a poller Service.
func NewService(cfg *config.Config, db *store.Store) *Service {
	// Initialize Notification Service
	notifier := notification.NewService(db, cfg.HTTP.DashboardBaseURL)
	encryptor, err := security.NewEncryptorFromEnv()
	if err != nil {
		log.Warn().Err(err).Msg("poller encryption disabled; DB-backed devices will be skipped")
	}

	m := newPollerMetrics(cfg.Metrics.Enabled)
	return &Service{
		cfg:       cfg,
		store:     db,
		notifier:  notifier,
		jobs:      make(chan config.Switch, cfg.WorkerCount*2+1),
		metrics:   m,
		encryptor: encryptor,
	}
}

// Run spins up workers and schedules polls until ctx done.
func (s *Service) Run(ctx context.Context) {
	// Fetch default tenant
	// We retry a few times because DB might be starting up
	defaultSlug := s.cfg.DefaultTenantSlug
	if defaultSlug == "" {
		defaultSlug = "default"
	}
	for i := 0; i < 10; i++ {
		t, err := s.store.GetTenantBySlug(ctx, defaultSlug)
		if err == nil {
			s.defaultTenantID = t.ID
			break
		}
		log.Warn().Err(err).Msg("failed to fetch default tenant, retrying...")
		select {
		case <-ctx.Done():
			return
		case <-time.After(2 * time.Second):
		}
	}
	if s.defaultTenantID == "" {
		log.Fatal().Msg("could not determine default tenant")
	}
	log.Info().Str("tenant_id", s.defaultTenantID).Msg("using default tenant")

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
	switches := s.loadDBSwitches(ctx)
	if len(switches) == 0 {
		switches = s.cfg.Switches
	}
	for _, sw := range switches {
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

func (s *Service) loadDBSwitches(ctx context.Context) []config.Switch {
	if s.encryptor == nil {
		return nil
	}
	devices, err := s.store.ListPollerDevices(ctx, s.defaultTenantID, s.cfg.PollerDeviceLimit)
	if err != nil {
		log.Warn().Err(err).Msg("failed to list poller devices")
		return nil
	}

	now := time.Now().UTC()
	switches := make([]config.Switch, 0, len(devices))
	for _, d := range devices {
		interval := time.Duration(d.PollingIntervalSeconds) * time.Second
		if interval <= 0 {
			interval = s.cfg.PollInterval.Duration
		}
		if d.LastSeen != nil && !d.LastSeen.IsZero() && now.Sub(*d.LastSeen) < interval {
			continue
		}
		sw, ok := s.deviceToSwitch(d)
		if !ok {
			continue
		}
		switches = append(switches, sw)
		if s.cfg.PollerDeviceLimit > 0 && len(switches) >= s.cfg.PollerDeviceLimit {
			break
		}
	}
	return switches
}

func (s *Service) deviceToSwitch(d store.Device) (config.Switch, bool) {
	payload, err := s.encryptor.Decrypt(d.SNMPConfigEncrypted)
	if err != nil {
		log.Warn().Err(err).Str("device", d.Hostname).Msg("failed to decrypt SNMP config")
		return config.Switch{}, false
	}
	var snmpCfg devicereg.SNMPConfig
	if err := json.Unmarshal(payload, &snmpCfg); err != nil {
		log.Warn().Err(err).Str("device", d.Hostname).Msg("failed to decode SNMP config")
		return config.Switch{}, false
	}
	version := snmpCfg.Version
	switch version {
	case "2c", "2", "":
		version = "2c"
	case "1":
		// supported
	case "3":
		log.Warn().Str("device", d.Hostname).Msg("SNMPv3 not supported by poller; skipping device")
		return config.Switch{}, false
	default:
		log.Warn().Str("device", d.Hostname).Str("version", snmpCfg.Version).Msg("unknown SNMP version; skipping device")
		return config.Switch{}, false
	}
	sw := config.Switch{
		Name:        d.Hostname,
		Address:     normalizeHost(d.MgmtIP),
		Community:   snmpCfg.Community,
		Version:     version,
		Port:        s.cfg.SNMP.Port,
		Timeout:     s.cfg.SNMP.Timeout,
		Retries:     s.cfg.SNMP.Retries,
		Site:        d.Site,
		Description: d.Description,
		DeviceID:    d.ID,
	}
	defaultEnabled := true
	sw.Enabled = &defaultEnabled
	return sw, true
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
				s.markDeviceFailure(ctx, sw)
			} else {
				s.metrics.observeDuration(sw.Name, time.Since(start))
			}
			s.metrics.setLastStatus(sw.Name, err == nil)
		}
	}
}

func (s *Service) pollDevice(ctx context.Context, sw config.Switch) error {
	sw.Address = normalizeHost(sw.Address)
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
		TenantID:    s.defaultTenantID,
		Hostname:    sw.Name,
		MgmtIP:      sw.Address,
		Community:   sw.Community,
		Enabled:     sw.EnabledValue(),
		Site:        sw.Site,
		Description: sw.Description,
		LastSeen:    &pollTime,
		Status:      "active",
	}
	deviceID, err := s.store.UpsertDevice(ctx, device)
	if err != nil {
		return err
	}

	prevStates, err := s.store.GetInterfaceStates(ctx, s.defaultTenantID, deviceID)
	if err != nil {
		logger.Warn().Err(err).Msg("load previous interface state")
		prevStates = map[int]store.InterfaceState{}
	}

	prevCounters, err := s.store.LatestInterfaceCounters(ctx, s.defaultTenantID, deviceID)
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
	s.evaluateAlerts(ctx, s.defaultTenantID, deviceID, pollTime, ifaces, prevStates, prevCounters)
	return nil
}

func normalizeHost(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return trimmed
	}
	if idx := strings.Index(trimmed, "/"); idx >= 0 {
		return strings.TrimSpace(trimmed[:idx])
	}
	return trimmed
}

func (s *Service) markDeviceFailure(ctx context.Context, sw config.Switch) {
	if sw.DeviceID > 0 {
		if err := s.store.UpdateDeviceStatus(ctx, s.defaultTenantID, sw.DeviceID, "error", nil); err != nil {
			log.Warn().Err(err).Str("device", sw.Name).Msg("failed to update device status")
		}
		return
	}
	if err := s.store.UpdateDeviceStatusByHostname(ctx, s.defaultTenantID, sw.Name, "error"); err != nil {
		log.Warn().Err(err).Str("device", sw.Name).Msg("failed to update device status")
	}
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
