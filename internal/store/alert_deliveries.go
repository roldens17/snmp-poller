package store

import "context"

func (s *Store) RecordAlertDelivery(ctx context.Context, d AlertDelivery) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO alert_deliveries (tenant_id, destination_id, alert_id, event, attempt, status_code, success, duration_ms, error)
		VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, NULLIF($9,''))
	`, d.TenantID, d.DestinationID, d.AlertID, d.Event, d.Attempt, d.StatusCode, d.Success, d.DurationMs, d.Error)
	return err
}

func (s *Store) ListAlertDeliveries(ctx context.Context, tenantID string, limit int) ([]AlertDelivery, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, tenant_id::text, destination_id::text, alert_id, event, attempt, status_code, success, COALESCE(duration_ms,0), COALESCE(error,''), created_at
		FROM alert_deliveries
		WHERE tenant_id=$1::uuid
		ORDER BY created_at DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AlertDelivery{}
	for rows.Next() {
		var d AlertDelivery
		if err := rows.Scan(&d.ID, &d.TenantID, &d.DestinationID, &d.AlertID, &d.Event, &d.Attempt, &d.StatusCode, &d.Success, &d.DurationMs, &d.Error, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
