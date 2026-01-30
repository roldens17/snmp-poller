package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/fresatu/snmp-poller/internal/store"
	"github.com/rs/zerolog/log"
)

// Service handles dispatching notifications.
type Service struct {
	store           *store.Store
	dashboardBaseURL string
}

// NewService creates a notification service.
func NewService(db *store.Store, dashboardBaseURL string) *Service {
	return &Service{store: db, dashboardBaseURL: dashboardBaseURL}
}

// EventType defines alert lifecycle events.
type EventType string

const (
	EventAlertCreated  EventType = "alert.created"
	EventAlertResolved EventType = "alert.resolved"
)

// Payload structure for webhooks.
type WebhookPayload struct {
	Tenant TenantInfo `json:"tenant"`
	Event  EventType  `json:"event"`
	Alert  AlertInfo  `json:"alert"`
	Links  LinksInfo  `json:"links"`
}

type TenantInfo struct {
	ID string `json:"id"`
}

type AlertInfo struct {
	ID         int64      `json:"id"`
	Severity   string     `json:"severity"`
	Message    string     `json:"message"`
	DeviceID   int64      `json:"device_id"`
	CreatedAt  time.Time  `json:"created_at"`
	ResolvedAt *time.Time `json:"resolved_at,omitempty"`
}

type LinksInfo struct {
	Dashboard string `json:"dashboard"`
}

// Dispatch sends notifications for a specific alert event.
func (s *Service) Dispatch(ctx context.Context, tenantID string, event EventType, alert store.Alert) {
	// fetching enabled destinations
	dests, err := s.store.ListEnabledAlertDestinations(ctx, tenantID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("failed to list alert destinations for dispatch")
		return
	}

	if len(dests) == 0 {
		return
	}

	dashboardURL := s.dashboardBaseURL
	if dashboardURL == "" {
		// Fallback to local default if not configured.
		dashboardURL = "http://localhost:3000"
	}
	payload := WebhookPayload{
		Tenant: TenantInfo{ID: tenantID},
		Event:  event,
		Alert: AlertInfo{
			ID:         alert.ID,
			Severity:   alert.Severity,
			Message:    alert.Message,
			DeviceID:   alert.DeviceID,
			CreatedAt:  alert.TriggeredAt,
			ResolvedAt: alert.ResolvedAt,
		},
		Links: LinksInfo{
			Dashboard: dashboardURL + "/alerts",
		},
	}

	body, _ := json.Marshal(payload)

	for _, d := range dests {
		go s.sendWebhook(ctx, tenantID, event, d, body)
	}
}

func (s *Service) sendWebhook(ctx context.Context, tenantID string, event EventType, dest store.AlertDestination, body []byte) {
	client := http.Client{
		Timeout: 5 * time.Second,
	}

	req, err := http.NewRequest("POST", dest.URL, bytes.NewBuffer(body))
	if err != nil {
		log.Error().Err(err).Str("url", dest.URL).Msg("failed to create webhook request")
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "SNMP-Poller-Notifier/1.0")

	// Simple retry logic
	for i := 0; i < 2; i++ {
		resp, err := client.Do(req)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				log.Info().Str("dest", dest.Name).Str("tenant_id", tenantID).Str("event", string(event)).Msg("webhook sent successfully")
				return
			}
			log.Warn().Str("dest", dest.Name).Str("tenant_id", tenantID).Str("event", string(event)).Int("status", resp.StatusCode).Msg("webhook failed with status")
		} else {
			log.Warn().Err(err).Str("dest", dest.Name).Str("tenant_id", tenantID).Str("event", string(event)).Msg("webhook request failed")
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(1 * time.Second):
		}
	}
}
