package poller

import (
	"context"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/fresatu/snmp-poller/internal/config"
	"github.com/fresatu/snmp-poller/internal/snmpclient"
	"github.com/fresatu/snmp-poller/internal/store"
)

func (s *Service) discoveryLoop(ctx context.Context) {
	if len(s.cfg.Discovery.Subnets) == 0 {
		return
	}
	logger := log.With().Str("component", "discovery").Logger()
	interval := s.cfg.Discovery.Interval.Duration
	if interval == 0 {
		interval = 15 * time.Minute
	}

	s.scanSubnets(ctx)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			logger.Info().Msg("starting discovery sweep")
			s.scanSubnets(ctx)
		}
	}
}

func (s *Service) scanSubnets(ctx context.Context) {
	workerCount := s.cfg.Discovery.WorkerCount
	if workerCount <= 0 {
		workerCount = 8
	}
	jobs := make(chan string, workerCount*2)
	var wg sync.WaitGroup
	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for ip := range jobs {
				s.probeHost(ctx, ip)
			}
		}(i)
	}

	for _, subnet := range s.cfg.Discovery.Subnets {
		ips, err := snmpclient.IPsFromCIDR(subnet, 4096)
		if err != nil {
			log.Warn().Err(err).Str("subnet", subnet).Msg("parse discovery subnet")
			continue
		}
		for _, ip := range ips {
			select {
			case <-ctx.Done():
				close(jobs)
				wg.Wait()
				return
			case jobs <- ip:
			}
		}
	}
	close(jobs)
	wg.Wait()
}

func (s *Service) probeHost(ctx context.Context, ip string) {
	target := config.Switch{
		Name:      ip,
		Address:   ip,
		Community: s.cfg.SNMP.Community,
		Version:   s.cfg.SNMP.Version,
		Port:      s.cfg.SNMP.Port,
		Timeout:   s.cfg.Discovery.Timeout,
		Retries:   s.cfg.SNMP.Retries,
		Enabled:   boolPtr(true),
	}

	timeout := s.cfg.Discovery.Timeout.Duration
	if timeout == 0 {
		timeout = 2 * time.Second
	}
	ctxProbe, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	res, err := snmpclient.ProbeDevice(ctxProbe, target)
	reachable := err == nil && res != nil && res.Reachable
	var hostname string
	if res != nil {
		hostname = res.Hostname
	}

	record := store.DiscoveryRecord{
		TenantID:    s.defaultTenantID,
		IP:          ip,
		Hostname:    hostname,
		Community:   target.Community,
		Reachable:   reachable,
		LastAttempt: time.Now().UTC(),
	}
	writeCtx, cancelWrite := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelWrite()
	if err := s.store.UpsertDiscoveryRecord(writeCtx, record); err != nil {
		log.Warn().Err(err).Msg("record discovery")
	}
}

func boolPtr(v bool) *bool {
	val := v
	return &val
}
