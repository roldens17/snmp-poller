package store

import (
	"context"
	"time"
)

func (s *Store) CreateInvite(ctx context.Context, tenantID, email, role, token, createdBy string, expiresAt time.Time) (*TenantInvite, error) {
	var inv TenantInvite
	err := s.pool.QueryRow(ctx, `
		INSERT INTO tenant_invites (tenant_id, email, role, token, expires_at, created_by)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id::text, tenant_id::text, email, role, token, expires_at, accepted_at, COALESCE(created_by::text,''), created_at
	`, tenantID, email, role, token, expiresAt.UTC(), createdBy).Scan(
		&inv.ID, &inv.TenantID, &inv.Email, &inv.Role, &inv.Token, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedBy, &inv.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (s *Store) ListInvites(ctx context.Context, tenantID string) ([]TenantInvite, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, tenant_id::text, email, role, token, expires_at, accepted_at, COALESCE(created_by::text,''), created_at
		FROM tenant_invites WHERE tenant_id=$1 ORDER BY created_at DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TenantInvite{}
	for rows.Next() {
		var inv TenantInvite
		if err := rows.Scan(&inv.ID, &inv.TenantID, &inv.Email, &inv.Role, &inv.Token, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedBy, &inv.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, inv)
	}
	return out, rows.Err()
}

func (s *Store) GetInviteByToken(ctx context.Context, token string) (*TenantInvite, error) {
	var inv TenantInvite
	err := s.pool.QueryRow(ctx, `
		SELECT id::text, tenant_id::text, email, role, token, expires_at, accepted_at, COALESCE(created_by::text,''), created_at
		FROM tenant_invites WHERE token=$1
	`, token).Scan(&inv.ID, &inv.TenantID, &inv.Email, &inv.Role, &inv.Token, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedBy, &inv.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (s *Store) MarkInviteAccepted(ctx context.Context, inviteID string) error {
	_, err := s.pool.Exec(ctx, `UPDATE tenant_invites SET accepted_at=now() WHERE id=$1`, inviteID)
	return err
}

func (s *Store) DeleteInvite(ctx context.Context, tenantID, inviteID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM tenant_invites WHERE id=$1 AND tenant_id=$2`, inviteID, tenantID)
	return err
}
