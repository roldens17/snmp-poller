package store

import (
	"context"
)

// CreateTenant creates a new tenant.
func (s *Store) CreateTenant(ctx context.Context, name, slug string) (*Tenant, error) {
	var t Tenant
	err := s.pool.QueryRow(ctx, `
		INSERT INTO tenants (name, slug) VALUES ($1, $2)
		RETURNING id, name, slug, created_at, updated_at
	`, name, slug).Scan(&t.ID, &t.Name, &t.Slug, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// GetTenantByID retrieves a tenant by ID.
func (s *Store) GetTenantByID(ctx context.Context, id string) (*Tenant, error) {
	var t Tenant
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, slug, created_at, updated_at FROM tenants WHERE id = $1
	`, id).Scan(&t.ID, &t.Name, &t.Slug, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// GetUserTenants returns the list of tenants a user belongs to.
func (s *Store) GetUserTenants(ctx context.Context, userID string) ([]Tenant, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT t.id, t.name, t.slug, t.created_at, t.updated_at
		FROM tenants t
		JOIN user_tenants ut ON t.id = ut.tenant_id
		WHERE ut.user_id = $1
		ORDER BY t.name
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tenants []Tenant
	for rows.Next() {
		var t Tenant
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		tenants = append(tenants, t)
	}
	return tenants, rows.Err()
}

// GetTenantBySlug retrieves a tenant by slug.
func (s *Store) GetTenantBySlug(ctx context.Context, slug string) (*Tenant, error) {
	var t Tenant
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, slug, created_at, updated_at FROM tenants WHERE slug = $1
	`, slug).Scan(&t.ID, &t.Name, &t.Slug, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// DeleteDemoData removes demo-generated data.
func (s *Store) DeleteDemoData(ctx context.Context, tenantID string) error {
	// Use explicit transactions if consistency needed, but simple execs are fine for demo reset.
	var err error
	_, err = s.pool.Exec(ctx, "DELETE FROM mac_entries WHERE tenant_id=$1 AND device_id IN (SELECT id FROM devices WHERE tenant_id=$1 AND hostname LIKE 'demo-%')", tenantID)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, "DELETE FROM alerts WHERE tenant_id=$1 AND device_id IN (SELECT id FROM devices WHERE tenant_id=$1 AND hostname LIKE 'demo-%')", tenantID)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, "DELETE FROM devices WHERE tenant_id=$1 AND hostname LIKE 'demo-%'", tenantID)
	return err
}

// AddUserToTenant adds a user to a tenant.
func (s *Store) AddUserToTenant(ctx context.Context, userID, tenantID, role string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO user_tenants (user_id, tenant_id, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = EXCLUDED.role, created_at = now()
	`, userID, tenantID, role)
	return err
}
