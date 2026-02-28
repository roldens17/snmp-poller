package alerts

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/fresatu/snmp-poller/internal/store"
)

type PollResult struct {
	TenantID   string
	DeviceID   string
	DeviceName string
	DeviceIP   string
	Success    bool
	Err        string
	PolledAt   time.Time
}

// ProcessPollResult applies deterministic alert transitions:
// - 3 consecutive failures => DOWN + active DEVICE_DOWN alert
// - 2 consecutive successes while DOWN => state UP + resolve active DEVICE_DOWN alert
func ProcessPollResult(ctx context.Context, db *store.Store, result PollResult) error {
	if result.TenantID == "" || result.DeviceID == "" {
		return fmt.Errorf("tenant_id and device_id required")
	}
	if result.PolledAt.IsZero() {
		result.PolledAt = time.Now().UTC()
	}
	deviceID, err := strconv.ParseInt(result.DeviceID, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid device_id: %w", err)
	}

	tx, err := db.Pool().Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Ensure row exists
	_, err = tx.Exec(ctx, `
		INSERT INTO device_state (tenant_id, device_id, current_state)
		VALUES ($1::uuid, $2, 'UNKNOWN')
		ON CONFLICT (tenant_id, device_id) DO NOTHING
	`, result.TenantID, deviceID)
	if err != nil {
		return err
	}

	var currentState string
	var failures, successes int
	var lastSuccessAt *time.Time
	err = tx.QueryRow(ctx, `
		SELECT current_state, consecutive_failures, consecutive_successes, last_success_at
		FROM device_state
		WHERE tenant_id=$1::uuid AND device_id=$2
		FOR UPDATE
	`, result.TenantID, deviceID).Scan(&currentState, &failures, &successes, &lastSuccessAt)
	if err != nil {
		return err
	}

	tr := ComputeTransition(StateInput{
		CurrentState:         currentState,
		ConsecutiveFailures:  failures,
		ConsecutiveSuccesses: successes,
		PollSuccess:          result.Success,
	})
	failures = tr.ConsecutiveFailures
	successes = tr.ConsecutiveSuccesses
	if result.Success {
		now := result.PolledAt.UTC()
		lastSuccessAt = &now
	}

	newState := tr.NextState
	stateChanged := tr.Transition != "none"
	now := time.Now().UTC()

	if tr.Transition == "down" {
		newState = "DOWN"
		stateChanged = true
		details := map[string]any{
			"tenant_id":            result.TenantID,
			"device_id":            result.DeviceID,
			"device_name":          result.DeviceName,
			"device_ip":            result.DeviceIP,
			"alert_type":           "DEVICE_DOWN",
			"severity":             "critical",
			"triggered_at":         now,
			"last_success_at":      lastSuccessAt,
			"last_poll_at":         result.PolledAt.UTC(),
			"consecutive_failures": failures,
			"error":                result.Err,
			"retry_policy": map[string]any{
				"poll_interval_seconds": 60,
				"fail_threshold":        3,
				"clear_threshold":       2,
			},
		}
		detailsJSON, _ := json.Marshal(details)
		_, err = tx.Exec(ctx, `
			INSERT INTO alerts (tenant_id, device_id, alert_type, severity, title, details, triggered_at, status, last_seen_at, message, category, metadata)
			VALUES ($1::uuid, $2, 'DEVICE_DOWN', 'critical', 'Device unreachable', $3::jsonb, $4, 'active', $4, 'Device unreachable', 'device_down', $3::jsonb)
			ON CONFLICT DO NOTHING
		`, result.TenantID, deviceID, string(detailsJSON), now)
		if err != nil {
			return err
		}
	} else if tr.Transition == "up" {
		newState = "UP"
		stateChanged = true
		_, err = tx.Exec(ctx, `
			UPDATE alerts
			SET status='resolved', resolved_at=$3, last_seen_at=$3
			WHERE tenant_id=$1::uuid AND device_id=$2 AND alert_type='DEVICE_DOWN' AND status='active'
		`, result.TenantID, deviceID, now)
		if err != nil {
			return err
		}
	} else if newState == "DOWN" && !result.Success {
		_, err = tx.Exec(ctx, `
			UPDATE alerts
			SET last_seen_at=$3,
				details=jsonb_set(COALESCE(details,'{}'::jsonb), '{error}', to_jsonb($4::text), true)
			WHERE tenant_id=$1::uuid AND device_id=$2 AND alert_type='DEVICE_DOWN' AND status='active'
		`, result.TenantID, deviceID, now, result.Err)
		if err != nil {
			return err
		}
	}

	if stateChanged {
		_, err = tx.Exec(ctx, `
			UPDATE device_state
			SET current_state=$3,
				consecutive_failures=$4,
				consecutive_successes=$5,
				last_poll_at=$6,
				last_success_at=$7,
				last_state_change_at=$8,
				updated_at=$8
			WHERE tenant_id=$1::uuid AND device_id=$2
		`, result.TenantID, deviceID, newState, failures, successes, result.PolledAt.UTC(), lastSuccessAt, now)
	} else {
		_, err = tx.Exec(ctx, `
			UPDATE device_state
			SET consecutive_failures=$3,
				consecutive_successes=$4,
				last_poll_at=$5,
				last_success_at=$6,
				updated_at=$7
			WHERE tenant_id=$1::uuid AND device_id=$2
		`, result.TenantID, deviceID, failures, successes, result.PolledAt.UTC(), lastSuccessAt, now)
	}
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}
