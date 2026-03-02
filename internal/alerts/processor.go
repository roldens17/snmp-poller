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
	TenantID             string
	DeviceID             string
	DeviceName           string
	DeviceIP             string
	Success              bool
	Err                  string
	PolledAt             time.Time
	RequestID            string
	DurationMS           int64
	PollIntervalSeconds  int
	FailThreshold        int
	ClearThreshold       int
}

func ProcessPollResult(ctx context.Context, db *store.Store, result PollResult) error {
	if result.TenantID == "" || result.DeviceID == "" {
		return fmt.Errorf("tenant_id and device_id required")
	}
	if result.PolledAt.IsZero() {
		result.PolledAt = time.Now().UTC()
	}
	if result.PollIntervalSeconds <= 0 {
		result.PollIntervalSeconds = 60
	}
	if result.FailThreshold <= 0 {
		result.FailThreshold = 3
	}
	if result.ClearThreshold <= 0 {
		result.ClearThreshold = 2
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

	now := time.Now().UTC()
	newState := tr.NextState
	stateChanged := tr.Transition != "none"

	kind, summaryTitle, summaryMessage := "", "", ""
	if !result.Success {
		kind, summaryTitle, summaryMessage = classifyError(fmt.Errorf("%s", result.Err))
	}
	if summaryTitle == "" {
		summaryTitle = "Device reachable"
	}
	if summaryMessage == "" {
		summaryMessage = "SNMP poll succeeded"
	}

	summary := map[string]any{
		"title":                summaryTitle,
		"message":              summaryMessage,
		"kind":                 kind,
		"transport":            "udp",
		"port":                 161,
		"snmp_version":         "2c",
		"last_success_at":      lastSuccessAt,
		"consecutive_failures": failures,
		"poll_interval_seconds": result.PollIntervalSeconds,
		"fail_threshold":       result.FailThreshold,
		"clear_threshold":      result.ClearThreshold,
	}

	details := map[string]any{
		"raw_error":      result.Err,
		"raw_error_full": result.Err,
		"stack":          "",
		"debug": map[string]any{
			"source_ip": "",
			"target":    fmt.Sprintf("%s:%d", result.DeviceIP, 161),
			"phase":     "poll",
			"library":   "gosnmp",
			"request_id": result.RequestID,
		},
	}

	payload := map[string]any{
		"tenant_id":   result.TenantID,
		"device_id":   result.DeviceID,
		"device_name": result.DeviceName,
		"device_ip":   result.DeviceIP,
		"summary":     summary,
		"details":     details,
		"error":       result.Err, // legacy compatibility
	}

	payloadJSON, _ := json.Marshal(payload)

	var activeAlertID int64
	err = tx.QueryRow(ctx, `
		SELECT id FROM alerts
		WHERE tenant_id=$1::uuid AND device_id=$2 AND alert_type='DEVICE_DOWN' AND status='active'
		ORDER BY triggered_at DESC
		LIMIT 1
	`, result.TenantID, deviceID).Scan(&activeAlertID)
	if err != nil {
		activeAlertID = 0
	}

	if tr.Transition == "down" {
		newState = "DOWN"
		stateChanged = true
		_, err = tx.Exec(ctx, `
			INSERT INTO alerts (tenant_id, device_id, alert_type, severity, title, details, triggered_at, status, last_seen_at, message, category, metadata)
			VALUES ($1::uuid, $2, 'DEVICE_DOWN', 'critical', $3, $4::jsonb, $5, 'active', $5, $6, 'device_down', $4::jsonb)
			ON CONFLICT DO NOTHING
		`, result.TenantID, deviceID, summaryTitle, string(payloadJSON), now, summaryMessage)
		if err != nil {
			return err
		}
		if activeAlertID == 0 {
			err = tx.QueryRow(ctx, `
				SELECT id FROM alerts
				WHERE tenant_id=$1::uuid AND device_id=$2 AND alert_type='DEVICE_DOWN' AND status='active'
				ORDER BY triggered_at DESC
				LIMIT 1
			`, result.TenantID, deviceID).Scan(&activeAlertID)
			if err != nil {
				activeAlertID = 0
			}
		}
	} else if tr.Transition == "up" {
		newState = "UP"
		stateChanged = true
		if activeAlertID > 0 {
			eventMeta, _ := json.Marshal(map[string]any{"kind": kind, "message": "Device recovered", "consecutive_successes": successes, "request_id": result.RequestID, "duration_ms": result.DurationMS})
			_, _ = tx.Exec(ctx, `
				INSERT INTO audit_events (tenant_id, action, resource, resource_id, metadata)
				VALUES ($1::uuid, 'ALERT_CLEARED', 'alert', $2, $3::jsonb)
			`, result.TenantID, fmt.Sprintf("%d", activeAlertID), string(eventMeta))
		}
		_, err = tx.Exec(ctx, `
			UPDATE alerts
			SET status='resolved', resolved_at=$3, last_seen_at=$3,
				details = jsonb_set(COALESCE(details, '{}'::jsonb), '{summary,message}', to_jsonb('Device recovered'::text), true)
			WHERE tenant_id=$1::uuid AND device_id=$2 AND alert_type='DEVICE_DOWN' AND status='active'
		`, result.TenantID, deviceID, now)
		if err != nil {
			return err
		}
	} else if newState == "DOWN" && !result.Success {
		_, err = tx.Exec(ctx, `
			UPDATE alerts
			SET last_seen_at=$3,
				message=$4,
				details=$5::jsonb
			WHERE tenant_id=$1::uuid AND device_id=$2 AND alert_type='DEVICE_DOWN' AND status='active'
		`, result.TenantID, deviceID, now, summaryMessage, string(payloadJSON))
		if err != nil {
			return err
		}
	}

	if activeAlertID > 0 {
		eventType := "POLL_FAILURE"
		eventMeta := map[string]any{"kind": kind, "message": summaryMessage, "consecutive_failures": failures, "request_id": result.RequestID, "duration_ms": result.DurationMS}
		if result.Success {
			eventType = "POLL_SUCCESS"
			eventMeta = map[string]any{"message": "SNMP poll succeeded", "consecutive_successes": successes, "request_id": result.RequestID, "duration_ms": result.DurationMS}
		}
		metaJSON, _ := json.Marshal(eventMeta)
		_, _ = tx.Exec(ctx, `
			INSERT INTO audit_events (tenant_id, action, resource, resource_id, metadata)
			VALUES ($1::uuid, $2, 'alert', $3, $4::jsonb)
		`, result.TenantID, eventType, fmt.Sprintf("%d", activeAlertID), string(metaJSON))
		if tr.Transition == "down" {
			triggerMeta, _ := json.Marshal(map[string]any{"kind": kind, "message": summaryMessage, "consecutive_failures": failures, "request_id": result.RequestID, "duration_ms": result.DurationMS})
			_, _ = tx.Exec(ctx, `
				INSERT INTO audit_events (tenant_id, action, resource, resource_id, metadata)
				VALUES ($1::uuid, 'ALERT_TRIGGERED', 'alert', $2, $3::jsonb)
			`, result.TenantID, fmt.Sprintf("%d", activeAlertID), string(triggerMeta))
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
