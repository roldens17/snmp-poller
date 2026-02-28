package store

import (
	"context"
	"time"
)

type TenantOverview struct {
	TenantID      string     `json:"tenant_id"`
	Name          string     `json:"name"`
	TotalDevices  int        `json:"total_devices"`
	DevicesDown   int        `json:"devices_down"`
	ActiveAlerts  int        `json:"active_alerts"`
	LastPollAt    *time.Time `json:"last_poll_at,omitempty"`
	StatusColor   string     `json:"status_color"`
	CriticalCount int        `json:"critical_count"`
}

type AlertAPIItem struct {
	ID          int64      `json:"id"`
	TenantID    string     `json:"tenant_id"`
	DeviceID    int64      `json:"device_id"`
	AlertType   string     `json:"alert_type"`
	Severity    string     `json:"severity"`
	Title       string     `json:"title"`
	Status      string     `json:"status"`
	TriggeredAt time.Time  `json:"triggered_at"`
	ResolvedAt  *time.Time `json:"resolved_at,omitempty"`
	LastSeenAt  time.Time  `json:"last_seen_at"`
	Details     string     `json:"details"`
}

func (s *Store) ListAlertsAPI(ctx context.Context, tenantID string, status string, limit int) ([]AlertAPIItem, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	if status == "" {
		status = "active"
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, tenant_id::text, device_id, alert_type, severity, title, status, triggered_at, resolved_at, last_seen_at, details::text
		FROM alerts
		WHERE tenant_id=$1::uuid AND status=$2
		ORDER BY triggered_at DESC
		LIMIT $3
	`, tenantID, status, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AlertAPIItem{}
	for rows.Next() {
		var it AlertAPIItem
		if err := rows.Scan(&it.ID, &it.TenantID, &it.DeviceID, &it.AlertType, &it.Severity, &it.Title, &it.Status, &it.TriggeredAt, &it.ResolvedAt, &it.LastSeenAt, &it.Details); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

func (s *Store) TenantOverviewByIDs(ctx context.Context, tenantIDs []string) ([]TenantOverview, error) {
	if len(tenantIDs) == 0 {
		return []TenantOverview{}, nil
	}
	rows, err := s.pool.Query(ctx, `
		SELECT
		  t.id::text,
		  t.name,
		  COALESCE((SELECT count(*) FROM devices d WHERE d.tenant_id=t.id),0) AS total_devices,
		  COALESCE((SELECT count(*) FROM device_state ds WHERE ds.tenant_id=t.id AND ds.current_state='DOWN'),0) AS devices_down,
		  COALESCE((SELECT count(*) FROM alerts a WHERE a.tenant_id=t.id AND a.status='active'),0) AS active_alerts,
		  (SELECT max(ds.last_poll_at) FROM device_state ds WHERE ds.tenant_id=t.id) AS last_poll_at,
		  COALESCE((SELECT count(*) FROM alerts a WHERE a.tenant_id=t.id AND a.status='active' AND a.severity='critical'),0) AS critical_count
		FROM tenants t
		WHERE t.id = ANY($1::uuid[])
		ORDER BY t.name
	`, tenantIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TenantOverview{}
	for rows.Next() {
		var o TenantOverview
		if err := rows.Scan(&o.TenantID, &o.Name, &o.TotalDevices, &o.DevicesDown, &o.ActiveAlerts, &o.LastPollAt, &o.CriticalCount); err != nil {
			return nil, err
		}
		if o.DevicesDown >= 3 || o.CriticalCount > 0 {
			o.StatusColor = "red"
		} else if o.DevicesDown >= 1 {
			o.StatusColor = "yellow"
		} else {
			o.StatusColor = "green"
		}
		out = append(out, o)
	}
	return out, rows.Err()
}
