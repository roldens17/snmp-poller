package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

// AlertFilter narrows alert queries.
type AlertFilter struct {
	DeviceID *int64
	Active   *bool
}

// UpsertAlert ensures a single active alert per device/ifIndex/category.
func (s *Store) UpsertAlert(ctx context.Context, alert Alert) error {
	var (
		id       int64
		severity string
		message  string
		metadata any
	)
	row := s.pool.QueryRow(ctx, `SELECT id, severity, message, metadata FROM alerts WHERE org_id=$1 AND device_id=$2 AND category=$3 AND COALESCE(if_index, -1) = COALESCE($4, -1) AND resolved_at IS NULL`, alert.OrgID, alert.DeviceID, alert.Category, alert.IfIndex)
	switch err := row.Scan(&id, &severity, &message, &metadata); {
	case err == nil:
		// For metadata comparison, we can skip for simplicity or use reflect.DeepEqual if needed.
		// Given it's been updated, let's just use it.
		_, err := s.pool.Exec(ctx, `UPDATE alerts SET severity=$1, message=$2, metadata=$3 WHERE id=$4`, alert.Severity, alert.Message, alert.Metadata, id)
		return err
	case errors.Is(err, pgx.ErrNoRows):
		_, err := s.pool.Exec(ctx, `INSERT INTO alerts (org_id, device_id, if_index, category, severity, message, metadata)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`, alert.OrgID, alert.DeviceID, alert.IfIndex, alert.Category, alert.Severity, alert.Message, alert.Metadata)
		return err
	default:
		return err
	}
}

// ResolveAlert marks an alert as resolved.
func (s *Store) ResolveAlert(ctx context.Context, orgID int64, deviceID int64, ifIndex *int, category string) error {
	_, err := s.pool.Exec(ctx, `UPDATE alerts SET resolved_at=now() WHERE org_id=$1 AND device_id=$2 AND COALESCE(if_index, -1) = COALESCE($3, -1) AND category=$4 AND resolved_at IS NULL`, orgID, deviceID, ifIndex, category)
	return err
}

// ListAlerts returns alert rows per filter.
func (s *Store) ListAlerts(ctx context.Context, orgID int64, filter AlertFilter) ([]Alert, error) {
	query := `SELECT id, org_id, device_id, if_index, category, severity, message, metadata, triggered_at, resolved_at FROM alerts`
	clauses := []string{"org_id=$1"}
	args := []any{orgID}

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
		if err := rows.Scan(&a.ID, &a.OrgID, &a.DeviceID, &a.IfIndex, &a.Category, &a.Severity, &a.Message, &a.Metadata, &a.TriggeredAt, &a.ResolvedAt); err != nil {
			return nil, err
		}
		alerts = append(alerts, a)
	}
	return alerts, rows.Err()
}
