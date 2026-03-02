package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

func (s *Store) GetActiveDeviceDownAlertID(ctx context.Context, tenantID string, deviceID int64) (int64, bool, error) {
	var id int64
	err := s.pool.QueryRow(ctx, `
		SELECT id
		FROM alerts
		WHERE tenant_id=$1::uuid AND device_id=$2 AND alert_type='DEVICE_DOWN' AND status='active'
		ORDER BY triggered_at DESC
		LIMIT 1
	`, tenantID, deviceID).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, false, nil
		}
		return 0, false, err
	}
	return id, true, nil
}

func (s *Store) AddAlertTimelineEvent(ctx context.Context, tenantID string, alertID int64, eventType string, metadata string) error {
	return s.AddAuditEvent(ctx, tenantID, "", eventType, "alert", fmt.Sprintf("%d", alertID), metadata, "")
}
