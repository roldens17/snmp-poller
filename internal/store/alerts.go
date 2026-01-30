package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// AlertFilter narrows alert queries.
type AlertFilter struct {
	DeviceID *int64
	Active   *bool
}

// UpsertAlert ensures a single active alert per device/ifIndex/category.
// Returns the alert state, true if newly created, and error.
func (s *Store) UpsertAlert(ctx context.Context, alert Alert) (*Alert, bool, error) {
	var (
		id          int64
		severity    string
		message     string
		metadata    any
		triggeredAt time.Time
	)
	// Check for existing active alert
	row := s.pool.QueryRow(ctx, `SELECT id, severity, message, metadata, triggered_at FROM alerts WHERE tenant_id=$1 AND device_id=$2 AND category=$3 AND COALESCE(if_index, -1) = COALESCE($4, -1) AND resolved_at IS NULL`, alert.TenantID, alert.DeviceID, alert.Category, alert.IfIndex)
	err := row.Scan(&id, &severity, &message, &metadata, &triggeredAt)

	if err == nil {
		// Update existing
		_, err := s.pool.Exec(ctx, `UPDATE alerts SET severity=$1, message=$2, metadata=$3 WHERE id=$4`, alert.Severity, alert.Message, alert.Metadata, id)
		alert.ID = id
		alert.TriggeredAt = triggeredAt
		return &alert, false, err
	} else if errors.Is(err, pgx.ErrNoRows) {
		// Insert new
		err := s.pool.QueryRow(ctx, `INSERT INTO alerts (tenant_id, device_id, if_index, category, severity, message, metadata)
		VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, triggered_at`, alert.TenantID, alert.DeviceID, alert.IfIndex, alert.Category, alert.Severity, alert.Message, alert.Metadata).Scan(&alert.ID, &alert.TriggeredAt)
		return &alert, true, err
	} else {
		return nil, false, err
	}
}

// ResolveAlert marks an alert as resolved and returns the resolved alert if found.
//
// The COALESCE(if_index, -1) pattern ensures that interface-less alerts
// (if_index IS NULL) are matched consistently using a sentinel value.
func (s *Store) ResolveAlert(ctx context.Context, tenantID string, deviceID int64, ifIndex *int, category string) (*Alert, error) {
	var alert Alert
	err := s.pool.QueryRow(ctx, `
		UPDATE alerts SET resolved_at=now() 
		WHERE tenant_id=$1 AND device_id=$2 AND COALESCE(if_index, -1) = COALESCE($3, -1) AND category=$4 AND resolved_at IS NULL
		RETURNING id, tenant_id, device_id, if_index, category, severity, message, metadata, triggered_at, resolved_at
	`, tenantID, deviceID, ifIndex, category).Scan(
		&alert.ID, &alert.TenantID, &alert.DeviceID, &alert.IfIndex, &alert.Category, &alert.Severity, &alert.Message, &alert.Metadata, &alert.TriggeredAt, &alert.ResolvedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil // No active alert to resolve
	}
	return &alert, err
}

// ListAlerts returns alert rows per filter.
func (s *Store) ListAlerts(ctx context.Context, tenantID string, filter AlertFilter) ([]Alert, error) {
	query := `SELECT id, tenant_id, device_id, if_index, category, severity, message, metadata, triggered_at, resolved_at FROM alerts`
	clauses := []string{"tenant_id=$1"}
	args := []any{tenantID}

	if filter.DeviceID != nil {
		args = append(args, *filter.DeviceID)
		clauses = append(clauses, fmt.Sprintf("device_id=$%d", len(args)))
	}
	if filter.Active != nil {
		if *filter.Active {
			clauses = append(clauses, "resolved_at IS NULL")
		} else {
			clauses = append(clauses, "resolved_at IS NOT NULL")
		}
	}

	if len(clauses) > 0 {
		query += " WHERE " + strings.Join(clauses, " AND ")
	}
	query += " ORDER BY triggered_at DESC LIMIT 500"

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []Alert
	for rows.Next() {
		var a Alert
		if err := rows.Scan(&a.ID, &a.TenantID, &a.DeviceID, &a.IfIndex, &a.Category, &a.Severity, &a.Message, &a.Metadata, &a.TriggeredAt, &a.ResolvedAt); err != nil {
			return nil, err
		}
		alerts = append(alerts, a)
	}
	return alerts, rows.Err()
}
