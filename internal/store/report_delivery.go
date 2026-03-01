package store

import "context"

type ReportRecipient struct {
	ID        int64  `json:"id"`
	TenantID  string `json:"tenant_id"`
	Email     string `json:"email"`
	Enabled   bool   `json:"enabled"`
	Frequency string `json:"frequency"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type ReportDeliveryHistory struct {
	ID             int64  `json:"id"`
	TenantID       string `json:"tenant_id"`
	ReportType     string `json:"report_type"`
	RecipientEmail string `json:"recipient_email"`
	Status         string `json:"status"`
	PeriodStart    string `json:"period_start,omitempty"`
	PeriodEnd      string `json:"period_end,omitempty"`
	Error          string `json:"error,omitempty"`
	CreatedAt      string `json:"created_at"`
	SentAt         string `json:"sent_at,omitempty"`
}

func (s *Store) ListReportRecipients(ctx context.Context, tenantID string) ([]ReportRecipient, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, tenant_id::text, email, enabled, frequency,
		       to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
		       to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')
		FROM report_recipients
		WHERE tenant_id=$1::uuid
		ORDER BY created_at DESC
	`, tenantID)
	if err != nil { return nil, err }
	defer rows.Close()
	out := []ReportRecipient{}
	for rows.Next() {
		var r ReportRecipient
		if err := rows.Scan(&r.ID, &r.TenantID, &r.Email, &r.Enabled, &r.Frequency, &r.CreatedAt, &r.UpdatedAt); err != nil { return nil, err }
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) UpsertReportRecipient(ctx context.Context, tenantID, email, frequency string, enabled bool) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO report_recipients (tenant_id, email, frequency, enabled)
		VALUES ($1::uuid, $2, $3, $4)
		ON CONFLICT (tenant_id, lower(email))
		DO UPDATE SET frequency=EXCLUDED.frequency, enabled=EXCLUDED.enabled, updated_at=now()
	`, tenantID, email, frequency, enabled)
	return err
}

func (s *Store) DeleteReportRecipient(ctx context.Context, tenantID string, id int64) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM report_recipients WHERE tenant_id=$1::uuid AND id=$2`, tenantID, id)
	return err
}

func (s *Store) AddReportDeliveryHistory(ctx context.Context, tenantID, recipient, reportType, status, periodStart, periodEnd, errText string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO report_delivery_history (tenant_id, report_type, recipient_email, status, period_start, period_end, error)
		VALUES ($1::uuid, $2, $3, $4, NULLIF($5,'')::timestamptz, NULLIF($6,'')::timestamptz, NULLIF($7,''))
	`, tenantID, reportType, recipient, status, periodStart, periodEnd, errText)
	return err
}

func (s *Store) ListReportDeliveryHistory(ctx context.Context, tenantID string, limit int) ([]ReportDeliveryHistory, error) {
	if limit <= 0 || limit > 500 { limit = 100 }
	rows, err := s.pool.Query(ctx, `
		SELECT id, tenant_id::text, report_type, recipient_email, status,
		       COALESCE(to_char(period_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),''),
		       COALESCE(to_char(period_end AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),''),
		       COALESCE(error,''),
		       to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
		       COALESCE(to_char(sent_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'')
		FROM report_delivery_history
		WHERE tenant_id=$1::uuid
		ORDER BY created_at DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	out := []ReportDeliveryHistory{}
	for rows.Next() {
		var h ReportDeliveryHistory
		if err := rows.Scan(&h.ID, &h.TenantID, &h.ReportType, &h.RecipientEmail, &h.Status, &h.PeriodStart, &h.PeriodEnd, &h.Error, &h.CreatedAt, &h.SentAt); err != nil { return nil, err }
		out = append(out, h)
	}
	return out, rows.Err()
}
