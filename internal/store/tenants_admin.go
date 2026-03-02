package store

import "context"

// ListAllTenants returns all tenants (superadmin scope).
func (s *Store) ListAllTenants(ctx context.Context) ([]Tenant, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, slug, plan_code, max_devices, billing_status, trial_ends_at, created_at, updated_at
		FROM tenants
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Tenant{}
	for rows.Next() {
		var t Tenant
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.PlanCode, &t.MaxDevices, &t.BillingStatus, &t.TrialEndsAt, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
