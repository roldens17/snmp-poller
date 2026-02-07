package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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
	if d.LastSeen != nil && !d.LastSeen.IsZero() {
		ls := d.LastSeen.UTC()
		lastSeen = &ls
	}
	status := strings.TrimSpace(d.Status)
	if status == "" {
		status = "active"
	}

	const q = `INSERT INTO devices (tenant_id, hostname, mgmt_ip, snmp_community, enabled, site, description, status, last_seen, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
		ON CONFLICT (tenant_id, hostname)
		DO UPDATE SET mgmt_ip=EXCLUDED.mgmt_ip,
			snmp_community=EXCLUDED.snmp_community,
			enabled=EXCLUDED.enabled,
			site=EXCLUDED.site,
			description=EXCLUDED.description,
			status=EXCLUDED.status,
			last_seen=EXCLUDED.last_seen,
			updated_at=now()
		RETURNING id`

	var id int64
	if err := s.pool.QueryRow(ctx, q, d.TenantID, d.Hostname, d.MgmtIP, d.Community, d.Enabled, d.Site, d.Description, status, lastSeen).Scan(&id); err != nil {
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
	row := s.pool.QueryRow(ctx, `SELECT id, tenant_id, hostname, mgmt_ip::text, '' as snmp_community, enabled,
		COALESCE(site, ''), COALESCE(description, ''), last_seen,
		COALESCE(device_type, ''), COALESCE(snmp_version, ''), COALESCE(polling_interval_seconds, 60),
		COALESCE(tags, ARRAY[]::text[]), COALESCE(status, 'pending'), last_tested_at, created_at, updated_at
		FROM devices WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	var d Device
	var lastSeen pgtype.Timestamptz
	if err := row.Scan(&d.ID, &d.TenantID, &d.Hostname, &d.MgmtIP, &d.Community, &d.Enabled,
		&d.Site, &d.Description, &lastSeen, &d.DeviceType, &d.SNMPVersion,
		&d.PollingIntervalSeconds, &d.Tags, &d.Status, &d.LastTestedAt, &d.CreatedAt, &d.UpdatedAt); err != nil {
		return nil, err
	}
	if lastSeen.Valid {
		d.LastSeen = &lastSeen.Time
	}
	return &d, nil
}

// ListDevices returns devices filtered by optional criteria.
func (s *Store) ListDevices(ctx context.Context, tenantID string, filter DeviceFilter) ([]Device, error) {
	base := `SELECT id, tenant_id, hostname, mgmt_ip::text, '' as snmp_community, enabled,
		COALESCE(site, ''), COALESCE(description, ''), last_seen,
		COALESCE(device_type, ''), COALESCE(snmp_version, ''), COALESCE(polling_interval_seconds, 60),
		COALESCE(tags, ARRAY[]::text[]), COALESCE(status, 'pending'), last_tested_at, created_at, updated_at
		FROM devices`
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
		var lastSeen pgtype.Timestamptz
		if err := rows.Scan(&d.ID, &d.TenantID, &d.Hostname, &d.MgmtIP, &d.Community, &d.Enabled,
			&d.Site, &d.Description, &lastSeen, &d.DeviceType, &d.SNMPVersion,
			&d.PollingIntervalSeconds, &d.Tags, &d.Status, &d.LastTestedAt, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		if lastSeen.Valid {
			d.LastSeen = &lastSeen.Time
		}
		list = append(list, d)
	}
	return list, rows.Err()
}

// ListPollerDevices returns enabled devices with encrypted SNMP config for polling.
func (s *Store) ListPollerDevices(ctx context.Context, tenantID string, limit int) ([]Device, error) {
	base := `SELECT id, tenant_id, hostname, mgmt_ip::text, enabled,
		COALESCE(site, ''), COALESCE(description, ''), last_seen,
		COALESCE(snmp_version, ''), snmp_config_encrypted, COALESCE(polling_interval_seconds, 60),
		COALESCE(status, 'active')
		FROM devices
		WHERE tenant_id=$1 AND enabled=true AND snmp_config_encrypted IS NOT NULL
			AND COALESCE(status, 'active') IN ('active', 'pending', 'error')
		ORDER BY last_seen NULLS FIRST, hostname`

	args := []any{tenantID}
	if limit > 0 {
		base += fmt.Sprintf(" LIMIT $%d", len(args)+1)
		args = append(args, limit)
	}

	rows, err := s.pool.Query(ctx, base, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Device
	for rows.Next() {
		var d Device
		var lastSeen pgtype.Timestamptz
		if err := rows.Scan(&d.ID, &d.TenantID, &d.Hostname, &d.MgmtIP, &d.Enabled,
			&d.Site, &d.Description, &lastSeen, &d.SNMPVersion, &d.SNMPConfigEncrypted,
			&d.PollingIntervalSeconds, &d.Status); err != nil {
			return nil, err
		}
		if lastSeen.Valid {
			d.LastSeen = &lastSeen.Time
		}
		list = append(list, d)
	}
	return list, rows.Err()
}

// UpdateDeviceStatus updates status and optionally last_seen for a device.
func (s *Store) UpdateDeviceStatus(ctx context.Context, tenantID string, id int64, status string, lastSeen *time.Time) error {
	status = strings.TrimSpace(status)
	if status == "" {
		return errors.New("status required")
	}
	if lastSeen != nil {
		_, err := s.pool.Exec(ctx, `UPDATE devices SET status=$1, last_seen=$2, updated_at=now() WHERE tenant_id=$3 AND id=$4`, status, lastSeen.UTC(), tenantID, id)
		return err
	}
	_, err := s.pool.Exec(ctx, `UPDATE devices SET status=$1, updated_at=now() WHERE tenant_id=$2 AND id=$3`, status, tenantID, id)
	return err
}

// UpdateDeviceStatusByHostname updates status for a device without touching last_seen.
func (s *Store) UpdateDeviceStatusByHostname(ctx context.Context, tenantID, hostname, status string) error {
	status = strings.TrimSpace(status)
	if status == "" {
		return errors.New("status required")
	}
	_, err := s.pool.Exec(ctx, `UPDATE devices SET status=$1, updated_at=now() WHERE tenant_id=$2 AND hostname=$3`, status, tenantID, hostname)
	return err
}

// GetDeviceIDByIP returns device id by tenant and mgmt ip.
func (s *Store) GetDeviceIDByIP(ctx context.Context, tenantID, ip string) (int64, bool, error) {
	var id int64
	err := s.pool.QueryRow(ctx, `SELECT id FROM devices WHERE tenant_id=$1 AND mgmt_ip=$2 LIMIT 1`, tenantID, ip).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, false, nil
		}
		return 0, false, err
	}
	return id, true, nil
}

// GetDeviceIDByHostname returns device id by tenant and hostname.
func (s *Store) GetDeviceIDByHostname(ctx context.Context, tenantID, hostname string) (int64, bool, error) {
	var id int64
	err := s.pool.QueryRow(ctx, `SELECT id FROM devices WHERE tenant_id=$1 AND hostname=$2 LIMIT 1`, tenantID, hostname).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, false, nil
		}
		return 0, false, err
	}
	return id, true, nil
}

// CreateDevice inserts a registered device record.
func (s *Store) CreateDevice(ctx context.Context, d *Device) (*Device, error) {
	const q = `INSERT INTO devices
		(tenant_id, hostname, mgmt_ip, snmp_community, enabled, site, description, device_type, snmp_version,
		snmp_config_encrypted, polling_interval_seconds, tags, status, last_tested_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
		RETURNING id, created_at, updated_at`
	row := s.pool.QueryRow(ctx, q, d.TenantID, d.Hostname, d.MgmtIP, d.Community, d.Enabled, d.Site, d.Description,
		d.DeviceType, d.SNMPVersion, d.SNMPConfigEncrypted, d.PollingIntervalSeconds, d.Tags, d.Status, d.LastTestedAt)
	if err := row.Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt); err != nil {
		return nil, err
	}
	return d, nil
}

// DeleteDevice removes a device scoped to a tenant.
// Associated interfaces, counters, MAC entries, and alerts are removed
// via ON DELETE CASCADE constraints.
func (s *Store) DeleteDevice(ctx context.Context, tenantID string, id int64) error {
	cmdTag, err := s.pool.Exec(ctx, `DELETE FROM devices WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	if cmdTag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
