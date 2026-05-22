package poller

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/fresatu/snmp-poller/internal/notification"
	"github.com/fresatu/snmp-poller/internal/snmpclient"
	"github.com/fresatu/snmp-poller/internal/store"
)

// alertAction describes a single raise-or-clear decision returned by computeAlertActions.
type alertAction struct {
	ifIndex  int
	category string
	action   string // "raise" | "clear"
	severity string
	message  string
}

// computeAlertActions is the pure decision function for per-interface alert
// evaluation. It has no side effects and is directly unit-testable.
func computeAlertActions(
	cfg alertingConfig,
	pollTime time.Time,
	metrics []snmpclient.InterfaceMetric,
	prev map[int]store.InterfaceState,
	prevCounters map[int]store.InterfaceCounters,
) []alertAction {
	var actions []alertAction
	for _, metric := range metrics {
		prevState, ok := prev[metric.Index]
		ifDown := metric.Admin == "up" && metric.Oper != "up"
		if ifDown && ok {
			durationDown := pollTime.Sub(prevState.StatusChangedAt)
			if durationDown >= cfg.InterfaceDownAfter && prevState.OperStatus != "" {
				actions = append(actions, alertAction{
					ifIndex:  metric.Index,
					category: "interface_down",
					action:   "raise",
					severity: "warning",
					message:  fmt.Sprintf("%s (%d) down for %s", metric.Name, metric.Index, durationDown.Round(time.Second)),
				})
				continue
			}
		}
		if !ifDown {
			actions = append(actions, alertAction{ifIndex: metric.Index, category: "interface_down", action: "clear"})
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
		if ratio >= cfg.ErrorRateThreshold && errorDelta > 0 {
			actions = append(actions, alertAction{
				ifIndex:  metric.Index,
				category: "error_rate",
				action:   "raise",
				severity: "warning",
				message:  fmt.Sprintf("%s error rate %.2f%%", metric.Name, ratio*100),
			})
		} else {
			actions = append(actions, alertAction{ifIndex: metric.Index, category: "error_rate", action: "clear"})
		}

		if metric.Speed > 0 && timeDelta > 0 && octetDelta > 0 {
			bps := snmpclient.BitsPerSecond(octetDelta, timeDelta)
			threshold := float64(metric.Speed) * cfg.BandwidthThreshold
			if bps >= threshold {
				actions = append(actions, alertAction{
					ifIndex:  metric.Index,
					category: "bandwidth",
					action:   "raise",
					severity: "info",
					message:  fmt.Sprintf("%s %.2f%% utilization", metric.Name, (bps/float64(metric.Speed))*100),
				})
			} else {
				actions = append(actions, alertAction{ifIndex: metric.Index, category: "bandwidth", action: "clear"})
			}
		}
	}
	return actions
}

// alertingConfig holds the thresholds used by computeAlertActions.
type alertingConfig struct {
	InterfaceDownAfter time.Duration
	ErrorRateThreshold float64
	BandwidthThreshold float64
}

func (s *Service) evaluateAlerts(ctx context.Context, tenantID string, deviceID int64, pollTime time.Time, metrics []snmpclient.InterfaceMetric, prev map[int]store.InterfaceState, prevCounters map[int]store.InterfaceCounters) {
	cfg := alertingConfig{
		InterfaceDownAfter: s.cfg.Alerting.InterfaceDownAfter.Duration,
		ErrorRateThreshold: s.cfg.Alerting.ErrorRateThreshold,
		BandwidthThreshold: s.cfg.Alerting.BandwidthThreshold,
	}
	for _, a := range computeAlertActions(cfg, pollTime, metrics, prev, prevCounters) {
		switch a.action {
		case "raise":
			s.raiseAlert(ctx, tenantID, deviceID, a.ifIndex, a.category, a.severity, a.message)
		case "clear":
			s.clearAlert(ctx, tenantID, deviceID, a.ifIndex, a.category)
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

	savedAlert, created, err := s.store.UpsertAlert(ctx, alert)
	if err != nil {
		log.Warn().Err(err).Msg("raise alert failed")
		return
	}

	if created {
		s.notifier.Dispatch(ctx, tenantID, notification.EventAlertCreated, *savedAlert)
	}
}

func (s *Service) clearAlert(ctx context.Context, tenantID string, deviceID int64, ifIndex int, category string) {
	idx := ifIndex
	resolvedAlert, err := s.store.ResolveAlert(ctx, tenantID, deviceID, &idx, category)
	if err != nil {
		log.Warn().Err(err).Msg("resolve alert failed")
		return
	}

	if resolvedAlert != nil {
		s.notifier.Dispatch(ctx, tenantID, notification.EventAlertResolved, *resolvedAlert)
	}
}

func (s *Service) raiseDeviceAlert(ctx context.Context, tenantID string, deviceID int64, category, severity, message string) {
	alert := store.Alert{
		TenantID: tenantID,
		DeviceID: deviceID,
		Category: category,
		Severity: severity,
		Message:  message,
		Metadata: "{}",
	}

	savedAlert, created, err := s.store.UpsertAlert(ctx, alert)
	if err != nil {
		log.Warn().Err(err).Msg("raise device alert failed")
		return
	}

	if created {
		s.notifier.Dispatch(ctx, tenantID, notification.EventAlertCreated, *savedAlert)
	}
}

func (s *Service) clearDeviceAlert(ctx context.Context, tenantID string, deviceID int64, category string) {
	resolvedAlert, err := s.store.ResolveAlert(ctx, tenantID, deviceID, nil, category)
	if err != nil {
		log.Warn().Err(err).Msg("resolve device alert failed")
		return
	}

	if resolvedAlert != nil {
		s.notifier.Dispatch(ctx, tenantID, notification.EventAlertResolved, *resolvedAlert)
	}
}
