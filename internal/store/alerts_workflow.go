package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

func scanAlertAPIItem(row pgx.Row, out *AlertAPIItem) error {
	return row.Scan(
		&out.ID,
		&out.TenantID,
		&out.DeviceID,
		&out.AlertType,
		&out.Severity,
		&out.Title,
		&out.Status,
		&out.TriggeredAt,
		&out.ResolvedAt,
		&out.LastSeenAt,
		&out.Details,
	)
}

func (s *Store) GetAlertAPIByID(ctx context.Context, tenantID string, alertID int64) (*AlertAPIItem, error) {
	var out AlertAPIItem
	err := scanAlertAPIItem(
		s.pool.QueryRow(ctx, `
			SELECT id, tenant_id::text, device_id, alert_type, severity, title, status, triggered_at, resolved_at, last_seen_at, details::text
			FROM alerts
			WHERE tenant_id=$1::uuid AND id=$2
		`, tenantID, alertID),
		&out,
	)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) AcknowledgeAlert(ctx context.Context, tenantID string, alertID int64, by, note string) (*AlertAPIItem, error) {
	var out AlertAPIItem
	err := scanAlertAPIItem(
		s.pool.QueryRow(ctx, `
			UPDATE alerts
			SET details = jsonb_set(
				jsonb_set(
					COALESCE(details, '{}'::jsonb),
					'{acknowledged_by}', to_jsonb($3::text), true
				),
				'{acknowledged_at}', to_jsonb(now()::text), true
			) || CASE WHEN $4='' THEN '{}'::jsonb ELSE jsonb_build_object('ack_note', $4) END,
			last_seen_at = now()
			WHERE tenant_id=$1::uuid AND id=$2
			RETURNING id, tenant_id::text, device_id, alert_type, severity, title, status, triggered_at, resolved_at, last_seen_at, details::text
		`, tenantID, alertID, by, note),
		&out,
	)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) MuteAlert(ctx context.Context, tenantID string, alertID int64, by string, minutes int) (*AlertAPIItem, error) {
	var out AlertAPIItem
	err := scanAlertAPIItem(
		s.pool.QueryRow(ctx, `
			UPDATE alerts
			SET details = jsonb_set(
				jsonb_set(
					COALESCE(details, '{}'::jsonb),
					'{muted_until}', to_jsonb((now() + ($4 || ' minutes')::interval)::text), true
				),
				'{muted_by}', to_jsonb($3::text), true
			),
			last_seen_at = now()
			WHERE tenant_id=$1::uuid AND id=$2
			RETURNING id, tenant_id::text, device_id, alert_type, severity, title, status, triggered_at, resolved_at, last_seen_at, details::text
		`, tenantID, alertID, by, minutes),
		&out,
	)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) AssignAlert(ctx context.Context, tenantID string, alertID int64, assignee string) (*AlertAPIItem, error) {
	var out AlertAPIItem
	err := scanAlertAPIItem(
		s.pool.QueryRow(ctx, `
			UPDATE alerts
			SET details = jsonb_set(
				COALESCE(details, '{}'::jsonb),
				'{assigned_to}', to_jsonb($3::text), true
			),
			last_seen_at = now()
			WHERE tenant_id=$1::uuid AND id=$2
			RETURNING id, tenant_id::text, device_id, alert_type, severity, title, status, triggered_at, resolved_at, last_seen_at, details::text
		`, tenantID, alertID, assignee),
		&out,
	)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) AddAlertComment(ctx context.Context, tenantID string, alertID int64, by, comment string) (*AlertAPIItem, error) {
	var out AlertAPIItem
	err := scanAlertAPIItem(
		s.pool.QueryRow(ctx, `
			UPDATE alerts
			SET details = jsonb_set(
				COALESCE(details, '{}'::jsonb),
				'{comments}',
				COALESCE(details->'comments', '[]'::jsonb) || jsonb_build_array(
					jsonb_build_object('by', $3, 'comment', $4, 'at', now()::text)
				),
				true
			),
			last_seen_at = now()
			WHERE tenant_id=$1::uuid AND id=$2
			RETURNING id, tenant_id::text, device_id, alert_type, severity, title, status, triggered_at, resolved_at, last_seen_at, details::text
		`, tenantID, alertID, by, comment),
		&out,
	)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) ResolveAlertByID(ctx context.Context, tenantID string, alertID int64) (*AlertAPIItem, error) {
	var out AlertAPIItem
	err := scanAlertAPIItem(
		s.pool.QueryRow(ctx, `
			UPDATE alerts
			SET status='resolved', resolved_at=COALESCE(resolved_at, now()), last_seen_at=now()
			WHERE tenant_id=$1::uuid AND id=$2
			RETURNING id, tenant_id::text, device_id, alert_type, severity, title, status, triggered_at, resolved_at, last_seen_at, details::text
		`, tenantID, alertID),
		&out,
	)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) SimulateDeviceDownAlert(ctx context.Context, tenantID string, deviceID int64, severity string) (*AlertAPIItem, error) {
	if severity == "" {
		severity = "critical"
	}

	_, err := s.pool.Exec(ctx, `
		INSERT INTO device_state (tenant_id, device_id, current_state, consecutive_failures, consecutive_successes, last_poll_at, last_state_change_at, updated_at)
		VALUES ($1::uuid, $2, 'DOWN', 3, 0, now(), now(), now())
		ON CONFLICT (tenant_id, device_id)
		DO UPDATE SET current_state='DOWN', consecutive_failures=GREATEST(device_state.consecutive_failures, 3), consecutive_successes=0, last_poll_at=now(), last_state_change_at=COALESCE(device_state.last_state_change_at, now()), updated_at=now()
	`, tenantID, deviceID)
	if err != nil {
		return nil, err
	}

	var out AlertAPIItem
	err = scanAlertAPIItem(
		s.pool.QueryRow(ctx, `
			WITH existing AS (
				UPDATE alerts
				SET severity=$3, title='Device Down', message='Device is unreachable after consecutive failed polls', last_seen_at=now(),
					details = jsonb_set(
						COALESCE(details,'{}'::jsonb),
						'{reason}', to_jsonb('simulated incident'::text), true
					)
				WHERE tenant_id=$1::uuid AND device_id=$2 AND alert_type='DEVICE_DOWN' AND status='active'
				RETURNING id, tenant_id::text, device_id, alert_type, severity, title, status, triggered_at, resolved_at, last_seen_at, details::text
			), created AS (
				INSERT INTO alerts (tenant_id, device_id, category, severity, message, metadata, alert_type, title, details, status, last_seen_at)
				SELECT $1::uuid, $2, 'device.down', $3, 'Device is unreachable after consecutive failed polls', '{}'::jsonb, 'DEVICE_DOWN', 'Device Down',
					jsonb_build_object('reason', 'simulated incident'), 'active', now()
				WHERE NOT EXISTS (SELECT 1 FROM existing)
				RETURNING id, tenant_id::text, device_id, alert_type, severity, title, status, triggered_at, resolved_at, last_seen_at, details::text
			)
			SELECT * FROM existing
			UNION ALL
			SELECT * FROM created
			LIMIT 1
		`, tenantID, deviceID, severity),
		&out,
	)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) SimulateDeviceRecover(ctx context.Context, tenantID string, deviceID int64) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE device_state
		SET current_state='UP', consecutive_failures=0, consecutive_successes=1, last_poll_at=now(), last_success_at=now(), updated_at=now()
		WHERE tenant_id=$1::uuid AND device_id=$2
	`, tenantID, deviceID)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		UPDATE alerts
		SET status='resolved', resolved_at=COALESCE(resolved_at, now()), last_seen_at=now()
		WHERE tenant_id=$1::uuid AND device_id=$2 AND alert_type='DEVICE_DOWN' AND status='active'
	`, tenantID, deviceID)
	return err
}

func (s *Store) PickAnyDeviceID(ctx context.Context, tenantID string) (int64, error) {
	var deviceID int64
	err := s.pool.QueryRow(ctx, `SELECT id FROM devices WHERE tenant_id=$1::uuid ORDER BY id LIMIT 1`, tenantID).Scan(&deviceID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, err
	}
	return deviceID, err
}
