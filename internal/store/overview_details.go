package store

import (
	"context"
	"time"
)

type TenantDownDevice struct {
	DeviceID        int64      `json:"device_id"`
	DeviceName      string     `json:"device_name"`
	DeviceIP        string     `json:"device_ip"`
	DownSince       *time.Time `json:"down_since,omitempty"`
	LastSuccessAt   *time.Time `json:"last_success_at,omitempty"`
	LastPollAt      *time.Time `json:"last_poll_at,omitempty"`
	CurrentState    string     `json:"current_state"`
}

type TenantActiveDeviceAlert struct {
	ID          int64      `json:"id"`
	DeviceID    int64      `json:"device_id"`
	Title       string     `json:"title"`
	Severity    string     `json:"severity"`
	TriggeredAt time.Time  `json:"triggered_at"`
	LastSeenAt  time.Time  `json:"last_seen_at"`
	ResolvedAt  *time.Time `json:"resolved_at,omitempty"`
	DeviceName  string     `json:"device_name"`
	DeviceIP    string     `json:"device_ip"`
}

func (s *Store) TenantOverviewDetails(ctx context.Context, tenantID string) ([]TenantDownDevice, []TenantActiveDeviceAlert, error) {
	downRows, err := s.pool.Query(ctx, `
		SELECT ds.device_id, COALESCE(d.hostname,''), COALESCE(d.mgmt_ip::text,''), ds.last_state_change_at, ds.last_success_at, ds.last_poll_at, ds.current_state
		FROM device_state ds
		JOIN devices d ON d.id=ds.device_id AND d.tenant_id=ds.tenant_id
		WHERE ds.tenant_id=$1::uuid AND ds.current_state='DOWN'
		ORDER BY ds.last_state_change_at DESC NULLS LAST
	`, tenantID)
	if err != nil {
		return nil, nil, err
	}
	defer downRows.Close()
	down := []TenantDownDevice{}
	for downRows.Next() {
		var d TenantDownDevice
		if err := downRows.Scan(&d.DeviceID, &d.DeviceName, &d.DeviceIP, &d.DownSince, &d.LastSuccessAt, &d.LastPollAt, &d.CurrentState); err != nil {
			return nil, nil, err
		}
		down = append(down, d)
	}
	if err := downRows.Err(); err != nil {
		return nil, nil, err
	}

	alertRows, err := s.pool.Query(ctx, `
		SELECT a.id, a.device_id, a.title, a.severity, a.triggered_at, a.last_seen_at, a.resolved_at,
			COALESCE(a.details->>'device_name', d.hostname, ''),
			COALESCE(a.details->>'device_ip', d.mgmt_ip::text, '')
		FROM alerts a
		LEFT JOIN devices d ON d.id=a.device_id AND d.tenant_id=a.tenant_id
		WHERE a.tenant_id=$1::uuid AND a.status='active' AND a.alert_type='DEVICE_DOWN'
		ORDER BY a.triggered_at DESC
	`, tenantID)
	if err != nil {
		return nil, nil, err
	}
	defer alertRows.Close()
	alerts := []TenantActiveDeviceAlert{}
	for alertRows.Next() {
		var a TenantActiveDeviceAlert
		if err := alertRows.Scan(&a.ID, &a.DeviceID, &a.Title, &a.Severity, &a.TriggeredAt, &a.LastSeenAt, &a.ResolvedAt, &a.DeviceName, &a.DeviceIP); err != nil {
			return nil, nil, err
		}
		alerts = append(alerts, a)
	}
	if err := alertRows.Err(); err != nil {
		return nil, nil, err
	}

	return down, alerts, nil
}
