package store

import (
	"context"
	"time"
)

type SLAReport struct {
	SLATargetPercent        float64 `json:"sla_target_percent"`
	SLABreached             bool    `json:"sla_breached"`
	DeficitMinutes          int64   `json:"deficit_minutes"`
	WindowDays              int     `json:"window_days"`
	TotalMinutes            int64   `json:"total_minutes"`
	DowntimeMinutes         int64   `json:"downtime_minutes"`
	UptimePercent           float64 `json:"uptime_percent"`
	IncidentsCount          int64   `json:"incidents_count"`
	AvgResolveMinutes       float64 `json:"avg_resolve_minutes"`
	WorstIncidentMinutes    int64   `json:"worst_incident_minutes"`
	MonitoredDeviceCount    int64   `json:"monitored_device_count"`
}

type IncidentRow struct {
	AlertID        int64      `json:"alert_id"`
	DeviceID       int64      `json:"device_id"`
	DeviceName     string     `json:"device_name"`
	DeviceIP       string     `json:"device_ip"`
	Severity       string     `json:"severity"`
	Status         string     `json:"status"`
	TriggeredAt    time.Time  `json:"triggered_at"`
	ResolvedAt     *time.Time `json:"resolved_at,omitempty"`
	DurationMinute int64      `json:"duration_minutes"`
}

func (s *Store) ReportIncidents(ctx context.Context, tenantID string, from, to time.Time, limit int) ([]IncidentRow, error) {
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	rows, err := s.pool.Query(ctx, `
		SELECT a.id, a.device_id,
		COALESCE(a.details->>'device_name', d.hostname, ''),
		COALESCE(a.details->>'device_ip', d.mgmt_ip::text, ''),
		a.severity, a.status, a.triggered_at, a.resolved_at,
		GREATEST(1, floor(extract(epoch from (COALESCE(a.resolved_at, now()) - a.triggered_at))/60))::bigint as duration_min
		FROM alerts a
		LEFT JOIN devices d ON d.id=a.device_id AND d.tenant_id=a.tenant_id
		WHERE a.tenant_id=$1::uuid
		  AND a.alert_type='DEVICE_DOWN'
		  AND a.triggered_at >= $2
		  AND a.triggered_at <= $3
		ORDER BY a.triggered_at DESC
		LIMIT $4
	`, tenantID, from.UTC(), to.UTC(), limit)
	if err != nil { return nil, err }
	defer rows.Close()
	out := []IncidentRow{}
	for rows.Next() {
		var r IncidentRow
		if err := rows.Scan(&r.AlertID, &r.DeviceID, &r.DeviceName, &r.DeviceIP, &r.Severity, &r.Status, &r.TriggeredAt, &r.ResolvedAt, &r.DurationMinute); err != nil { return nil, err }
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) ReportSLA(ctx context.Context, tenantID string, windowDays int) (*SLAReport, error) {
	if windowDays <= 0 { windowDays = 30 }
	to := time.Now().UTC()
	from := to.Add(-time.Duration(windowDays) * 24 * time.Hour)

	var deviceCount int64
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM devices WHERE tenant_id=$1::uuid`, tenantID).Scan(&deviceCount); err != nil { return nil, err }

	var slaTarget float64
	if err := s.pool.QueryRow(ctx, `SELECT COALESCE(sla_target_percent, 99.90) FROM tenants WHERE id=$1::uuid`, tenantID).Scan(&slaTarget); err != nil { return nil, err }
	if deviceCount == 0 {
		return &SLAReport{WindowDays: windowDays, TotalMinutes: int64(windowDays * 24 * 60), UptimePercent: 100, MonitoredDeviceCount: 0, SLATargetPercent: slaTarget, SLABreached: false, DeficitMinutes: 0}, nil
	}

	var incidents int64
	var downtime float64
	var avgResolve float64
	var worst float64
	err := s.pool.QueryRow(ctx, `
		SELECT
		  count(*)::bigint,
		  COALESCE(sum(extract(epoch from (COALESCE(resolved_at, now()) - triggered_at))/60),0) as downtime_min,
		  COALESCE(avg(extract(epoch from (COALESCE(resolved_at, now()) - triggered_at))/60),0) as avg_resolve,
		  COALESCE(max(extract(epoch from (COALESCE(resolved_at, now()) - triggered_at))/60),0) as worst_resolve
		FROM alerts
		WHERE tenant_id=$1::uuid
		  AND alert_type='DEVICE_DOWN'
		  AND triggered_at >= $2
	`, tenantID, from).Scan(&incidents, &downtime, &avgResolve, &worst)
	if err != nil { return nil, err }

	totalMinutes := int64(windowDays * 24 * 60)
	denom := float64(totalMinutes) * float64(deviceCount)
	uptime := 100.0
	if denom > 0 {
		uptime = 100.0 - ((downtime / denom) * 100.0)
		if uptime < 0 { uptime = 0 }
	}

	deficitMinutes := int64(0)
	slaBreached := uptime < slaTarget
	if slaBreached {
		allowedDowntime := (100.0 - slaTarget) / 100.0 * denom
		over := downtime - allowedDowntime
		if over > 0 { deficitMinutes = int64(over) }
	}

	return &SLAReport{
		SLATargetPercent:     slaTarget,
		SLABreached:          slaBreached,
		DeficitMinutes:       deficitMinutes,
		WindowDays:           windowDays,
		TotalMinutes:         totalMinutes,
		DowntimeMinutes:      int64(downtime),
		UptimePercent:        uptime,
		IncidentsCount:       incidents,
		AvgResolveMinutes:    avgResolve,
		WorstIncidentMinutes: int64(worst),
		MonitoredDeviceCount: deviceCount,
	}, nil
}


func (s *Store) UpdateSLATarget(ctx context.Context, tenantID string, target float64) error {
	_, err := s.pool.Exec(ctx, `UPDATE tenants SET sla_target_percent=$1, updated_at=now() WHERE id=$2::uuid`, target, tenantID)
	return err
}
