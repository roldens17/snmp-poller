package store

import (
	"context"
	"fmt"
)

// CreateAlertDestination inserts a new destination.
func (s *Store) CreateAlertDestination(ctx context.Context, dest *AlertDestination) error {
	return s.pool.QueryRow(ctx, `
		INSERT INTO alert_destinations (tenant_id, type, name, url, is_enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, now(), now())
		RETURNING id, created_at, updated_at
	`, dest.TenantID, dest.Type, dest.Name, dest.URL, dest.IsEnabled).Scan(&dest.ID, &dest.CreatedAt, &dest.UpdatedAt)
}

// ListAlertDestinations returns all destinations for a tenant.
func (s *Store) ListAlertDestinations(ctx context.Context, tenantID string) ([]AlertDestination, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, tenant_id, type, name, url, is_enabled, created_at, updated_at 
		FROM alert_destinations 
		WHERE tenant_id=$1 
		ORDER BY created_at ASC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dests []AlertDestination
	for rows.Next() {
		var d AlertDestination
		if err := rows.Scan(&d.ID, &d.TenantID, &d.Type, &d.Name, &d.URL, &d.IsEnabled, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		dests = append(dests, d)
	}
	return dests, rows.Err()
}

// UpdateAlertDestination updates mutable fields.
func (s *Store) UpdateAlertDestination(ctx context.Context, dest *AlertDestination) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE alert_destinations 
		SET name=$1, url=$2, is_enabled=$3, updated_at=now() 
		WHERE id=$4 AND tenant_id=$5
	`, dest.Name, dest.URL, dest.IsEnabled, dest.ID, dest.TenantID)
	return err
}

// DeleteAlertDestination removes a destination.
func (s *Store) DeleteAlertDestination(ctx context.Context, tenantID, id string) error {
	res, err := s.pool.Exec(ctx, `DELETE FROM alert_destinations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("not found")
	}
	return nil
}

// ListEnabledAlertDestinations returns enabled destinations for notification dispatch.
func (s *Store) ListEnabledAlertDestinations(ctx context.Context, tenantID string) ([]AlertDestination, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, tenant_id, type, name, url, is_enabled, created_at, updated_at 
		FROM alert_destinations 
		WHERE tenant_id=$1 AND is_enabled=true
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dests []AlertDestination
	for rows.Next() {
		var d AlertDestination
		if err := rows.Scan(&d.ID, &d.TenantID, &d.Type, &d.Name, &d.URL, &d.IsEnabled, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		dests = append(dests, d)
	}
	return dests, rows.Err()
}
