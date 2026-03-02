package store

import "context"

func (s *Store) ListTenantMembers(ctx context.Context, tenantID string) ([]TenantMember, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT u.id::text, u.email, COALESCE(u.name,''), ut.role, ut.created_at
		FROM user_tenants ut
		JOIN users u ON u.id = ut.user_id
		WHERE ut.tenant_id=$1::uuid
		ORDER BY ut.created_at ASC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TenantMember{}
	for rows.Next() {
		var m TenantMember
		if err := rows.Scan(&m.UserID, &m.Email, &m.Name, &m.Role, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) UpdateTenantMemberRole(ctx context.Context, tenantID, userID, role string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE user_tenants SET role=$1, created_at=created_at
		WHERE tenant_id=$2::uuid AND user_id=$3::uuid
	`, role, tenantID, userID)
	return err
}

func (s *Store) RemoveTenantMember(ctx context.Context, tenantID, userID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM user_tenants WHERE tenant_id=$1::uuid AND user_id=$2::uuid`, tenantID, userID)
	return err
}
