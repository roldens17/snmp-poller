package poller

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/fresatu/snmp-poller/internal/snmpclient"
	"github.com/fresatu/snmp-poller/internal/store"
)

func (s *Service) evaluateAlerts(ctx context.Context, tenantID string, deviceID int64, pollTime time.Time, metrics []snmpclient.InterfaceMetric, prev map[int]store.InterfaceState, prevCounters map[int]store.InterfaceCounters) {
	for _, metric := range metrics {
		prevState, ok := prev[metric.Index]
		ifDown := metric.Admin == "up" && metric.Oper != "up"
		if ifDown && ok {
			durationDown := pollTime.Sub(prevState.StatusChangedAt)
			if durationDown >= s.cfg.Alerting.InterfaceDownAfter.Duration && prevState.OperStatus != "" {
				s.raiseAlert(ctx, tenantID, deviceID, metric.Index, "interface_down", "warning", fmt.Sprintf("%s (%d) down for %s", metric.Name, metric.Index, durationDown.Round(time.Second)))
				continue
			}
		}
		if !ifDown {
			s.clearAlert(ctx, tenantID, deviceID, metric.Index, "interface_down")
		}

		prevCounter, countersOK := prevCounters[metric.Index]
		if !countersOK || prevCounter.CollectedAt.IsZero() {
			continue
		}

		timeDelta := pollTime.Sub(prevCounter.CollectedAt)
		if timeDelta <= 0 {
			continue
		}

		octetDelta := snmpclient.ClampCounter(metric.InOctets, prevCounter.InOctets) + snmpclient.ClampCounter(metric.OutOctets, prevCounter.OutOctets)
		errorDelta := snmpclient.ClampCounter(metric.InErrors, prevCounter.InErrors) + snmpclient.ClampCounter(metric.OutErrors, prevCounter.OutErrors)

		ratio := snmpclient.ErrorRate(errorDelta, octetDelta)
		if ratio >= s.cfg.Alerting.ErrorRateThreshold && errorDelta > 0 {
			s.raiseAlert(ctx, tenantID, deviceID, metric.Index, "error_rate", "warning", fmt.Sprintf("%s error rate %.2f%%", metric.Name, ratio*100))
		} else {
			s.clearAlert(ctx, tenantID, deviceID, metric.Index, "error_rate")
		}

		if metric.Speed > 0 && timeDelta > 0 && octetDelta > 0 {
			bps := snmpclient.BitsPerSecond(octetDelta, timeDelta)
			threshold := float64(metric.Speed) * s.cfg.Alerting.BandwidthThreshold
			if bps >= threshold {
				s.raiseAlert(ctx, tenantID, deviceID, metric.Index, "bandwidth", "info", fmt.Sprintf("%s %.2f%% utilization", metric.Name, (bps/float64(metric.Speed))*100))
			} else {
				s.clearAlert(ctx, tenantID, deviceID, metric.Index, "bandwidth")
			}
		}
	}
}

func (s *Service) raiseAlert(ctx context.Context, tenantID string, deviceID int64, ifIndex int, category, severity, message string) {
	idx := ifIndex
	alert := store.Alert{
		TenantID: tenantID,
		DeviceID: deviceID,
		IfIndex:  &idx,
		Category: category,
		Severity: severity,
		Message:  message,
		Metadata: "{}",
	}
	if err := s.store.UpsertAlert(ctx, alert); err != nil {
		log.Warn().Err(err).Msg("raise alert failed")
	}
}

func (s *Service) clearAlert(ctx context.Context, tenantID string, deviceID int64, ifIndex int, category string) {
	idx := ifIndex
	if err := s.store.ResolveAlert(ctx, tenantID, deviceID, &idx, category); err != nil {
		log.Warn().Err(err).Msg("resolve alert failed")
	}
}
