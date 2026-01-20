package store

import "context"

// UpsertDiscoveryRecord saves a discovery result.
func (s *Store) UpsertDiscoveryRecord(ctx context.Context, rec DiscoveryRecord) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO discovered_devices (tenant_id, ip, hostname, community, reachable, last_attempt)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (tenant_id, ip) DO UPDATE SET
			hostname=EXCLUDED.hostname,
			community=EXCLUDED.community,
			reachable=EXCLUDED.reachable,
			last_attempt=EXCLUDED.last_attempt`,
		rec.TenantID, rec.IP, rec.Hostname, rec.Community, rec.Reachable, rec.LastAttempt)
	return err
}

// ListDiscoveries returns latest discovery rows.
func (s *Store) ListDiscoveries(ctx context.Context, tenantID string) ([]DiscoveryRecord, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, tenant_id, ip, COALESCE(hostname, ''), COALESCE(community, ''), reachable, last_attempt FROM discovered_devices WHERE tenant_id=$1 ORDER BY last_attempt DESC LIMIT 500`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var recs []DiscoveryRecord
	for rows.Next() {
		var rec DiscoveryRecord
		if err := rows.Scan(&rec.ID, &rec.TenantID, &rec.IP, &rec.Hostname, &rec.Community, &rec.Reachable, &rec.LastAttempt); err != nil {
			return nil, err
		}
		recs = append(recs, rec)
	}
	return recs, rows.Err()
}
