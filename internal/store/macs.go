package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

// MACFilter filters mac table queries.
type MACFilter struct {
	DeviceID *int64
	VLAN     *int
	MACLike  string
}

// UpsertMacEntries persists bridge table entries.
func (s *Store) UpsertMacEntries(ctx context.Context, entries []MACEntry) error {
	if len(entries) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, entry := range entries {
		var vlan any
		if entry.VLAN != nil {
			vlan = *entry.VLAN
		}
		batch.Queue(`INSERT INTO mac_entries (device_id, vlan, mac, learned_port, first_seen, last_seen)
			VALUES ($1,$2,$3,$4,$5,$6)
			ON CONFLICT (device_id, vlan, mac)
			DO UPDATE SET learned_port=EXCLUDED.learned_port,
				last_seen=EXCLUDED.last_seen`,
			entry.DeviceID, vlan, strings.ToLower(entry.MAC), entry.IfIndex, entry.FirstSeen.UTC(), entry.LastSeen.UTC())
	}
	res := s.pool.SendBatch(ctx, batch)
	defer res.Close()
	for range entries {
		if _, err := res.Exec(); err != nil {
			return err
		}
	}
	return res.Close()
}

// GetMacEntries returns MAC table rows using optional filters.
func (s *Store) GetMacEntries(ctx context.Context, orgID int64, filter MACFilter) ([]MACEntry, error) {
	query := `SELECT m.device_id, m.vlan, m.mac, m.learned_port, m.first_seen, m.last_seen 
		FROM mac_entries m
		JOIN devices d ON m.device_id = d.id`
	clauses := []string{"d.org_id=$1"}
	args := []any{orgID}

	if filter.DeviceID != nil {
		args = append(args, *filter.DeviceID)
		clauses = append(clauses, fmt.Sprintf("m.device_id=$%d", len(args)))
	}
	if filter.VLAN != nil {
		args = append(args, *filter.VLAN)
		clauses = append(clauses, fmt.Sprintf("m.vlan=$%d", len(args)))
	}
	if filter.MACLike != "" {
		args = append(args, strings.ToLower(filter.MACLike)+"%")
		clauses = append(clauses, fmt.Sprintf("m.mac LIKE $%d", len(args)))
	}

	if len(clauses) > 0 {
		query += " WHERE " + strings.Join(clauses, " AND ")
	}
	query += " ORDER BY m.last_seen DESC LIMIT 1000"

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []MACEntry
	for rows.Next() {
		var entry MACEntry
		if err := rows.Scan(&entry.DeviceID, &entry.VLAN, &entry.MAC, &entry.IfIndex, &entry.FirstSeen, &entry.LastSeen); err != nil {
			return nil, err
		}
		list = append(list, entry)
	}
	return list, rows.Err()
}
