package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

// DeviceFilter allows filtering on device listing.
type DeviceFilter struct {
	Site    string
	Enabled *bool
}

// UpsertDevice inserts or updates a device record.
func (s *Store) UpsertDevice(ctx context.Context, d *Device) (int64, error) {
	if d.Hostname == "" {
		return 0, errors.New("hostname required")
	}
	var lastSeen *time.Time
	if !d.LastSeen.IsZero() {
		ls := d.LastSeen.UTC()
		lastSeen = &ls
	}

	const q = `INSERT INTO devices (tenant_id, hostname, mgmt_ip, snmp_community, enabled, site, description, last_seen, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
		ON CONFLICT (tenant_id, hostname)
		DO UPDATE SET mgmt_ip=EXCLUDED.mgmt_ip,
			snmp_community=EXCLUDED.snmp_community,
			enabled=EXCLUDED.enabled,
			site=EXCLUDED.site,
			description=EXCLUDED.description,
			last_seen=EXCLUDED.last_seen,
			updated_at=now()
		RETURNING id`

	var id int64
	if err := s.pool.QueryRow(ctx, q, d.TenantID, d.Hostname, d.MgmtIP, d.Community, d.Enabled, d.Site, d.Description, lastSeen).Scan(&id); err != nil {
		return 0, err
	}
	return id, nil
}

// TouchDeviceLastSeen updates last_seen on demand.
func (s *Store) TouchDeviceLastSeen(ctx context.Context, id int64, ts time.Time) error {
	_, err := s.pool.Exec(ctx, `UPDATE devices SET last_seen=$1, updated_at=now() WHERE id=$2`, ts.UTC(), id)
	return err
}

func (s *Store) GetDevice(ctx context.Context, tenantID string, id int64) (*Device, error) {
	row := s.pool.QueryRow(ctx, `SELECT id, tenant_id, hostname, mgmt_ip::text, snmp_community, enabled, COALESCE(site, ''), COALESCE(description, ''), COALESCE(last_seen, to_timestamp(0)), created_at, updated_at FROM devices WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	var d Device
	if err := row.Scan(&d.ID, &d.TenantID, &d.Hostname, &d.MgmtIP, &d.Community, &d.Enabled, &d.Site, &d.Description, &d.LastSeen, &d.CreatedAt, &d.UpdatedAt); err != nil {
		return nil, err
	}
	return &d, nil
}

// ListDevices returns devices filtered by optional criteria.
func (s *Store) ListDevices(ctx context.Context, tenantID string, filter DeviceFilter) ([]Device, error) {
	base := `SELECT id, tenant_id, hostname, mgmt_ip::text, snmp_community, enabled, COALESCE(site, ''), COALESCE(description, ''), COALESCE(last_seen, to_timestamp(0)), created_at, updated_at FROM devices`
	clauses := []string{"tenant_id=$1"}
	args := []any{tenantID}

	if filter.Site != "" {
		args = append(args, filter.Site)
		clauses = append(clauses, fmt.Sprintf("site=$%d", len(args)))
	}
	if filter.Enabled != nil {
		args = append(args, *filter.Enabled)
		clauses = append(clauses, fmt.Sprintf("enabled=$%d", len(args)))
	}

	if len(clauses) > 0 {
		base += " WHERE " + strings.Join(clauses, " AND ")
	}
	base += " ORDER BY hostname"

	rows, err := s.pool.Query(ctx, base, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Device
	for rows.Next() {
		var d Device
		if err := rows.Scan(&d.ID, &d.TenantID, &d.Hostname, &d.MgmtIP, &d.Community, &d.Enabled, &d.Site, &d.Description, &d.LastSeen, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, d)
	}
	return list, rows.Err()
}
