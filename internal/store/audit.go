package store

import "context"

func (s *Store) AddAuditEvent(ctx context.Context, tenantID, userID, action, resource, resourceID, metadata, ip string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO audit_events (tenant_id, user_id, action, resource, resource_id, metadata, ip)
		VALUES (NULLIF($1,'')::uuid, NULLIF($2,'')::uuid, $3, $4, NULLIF($5,''), COALESCE(NULLIF($6,'')::jsonb, '{}'::jsonb), NULLIF($7,'')::inet)
	`, tenantID, userID, action, resource, resourceID, metadata, ip)
	return err
}

func (s *Store) ListAuditEvents(ctx context.Context, tenantID string, limit int) ([]AuditEvent, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, COALESCE(tenant_id::text,''), COALESCE(user_id::text,''), action, resource, COALESCE(resource_id,''), metadata::text, COALESCE(host(ip), ''), created_at
		FROM audit_events
		WHERE tenant_id=$1::uuid
		ORDER BY created_at DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AuditEvent{}
	for rows.Next() {
		var e AuditEvent
		if err := rows.Scan(&e.ID, &e.TenantID, &e.UserID, &e.Action, &e.Resource, &e.ResourceID, &e.Metadata, &e.IP, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
