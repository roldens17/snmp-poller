package store

import "context"

// RecordDiscoveryResult upserts discovery attempts.
func (s *Store) RecordDiscoveryResult(ctx context.Context, rec DiscoveryRecord) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO discovered_devices (org_id, ip, hostname, community, reachable, last_attempt)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (org_id, ip)
		DO UPDATE SET hostname=EXCLUDED.hostname,
			community=EXCLUDED.community,
			reachable=EXCLUDED.reachable,
			last_attempt=EXCLUDED.last_attempt`, rec.OrgID, rec.IP, rec.Hostname, rec.Community, rec.Reachable, rec.LastAttempt.UTC())
	return err
}

// ListDiscoveries returns latest discovery rows.
func (s *Store) ListDiscoveries(ctx context.Context, orgID int64) ([]DiscoveryRecord, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, org_id, ip, COALESCE(hostname, ''), COALESCE(community, ''), reachable, last_attempt FROM discovered_devices WHERE org_id=$1 ORDER BY last_attempt DESC LIMIT 500`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var recs []DiscoveryRecord
	for rows.Next() {
		var rec DiscoveryRecord
		if err := rows.Scan(&rec.ID, &rec.OrgID, &rec.IP, &rec.Hostname, &rec.Community, &rec.Reachable, &rec.LastAttempt); err != nil {
			return nil, err
		}
		recs = append(recs, rec)
	}
	return recs, rows.Err()
}
