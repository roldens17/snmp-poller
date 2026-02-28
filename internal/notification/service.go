package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/fresatu/snmp-poller/internal/store"
	"github.com/rs/zerolog/log"
)

// Service handles dispatching notifications.
type Service struct {
	store            *store.Store
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
		Links: LinksInfo{Dashboard: dashboardURL + "/alerts"},
	}

	body, _ := json.Marshal(payload)
	for _, d := range dests {
		go s.sendWebhook(ctx, tenantID, event, alert.ID, d, body)
	}
}

func (s *Service) sendWebhook(ctx context.Context, tenantID string, event EventType, alertID int64, dest store.AlertDestination, body []byte) {
	client := http.Client{Timeout: 8 * time.Second}

	const maxAttempts = 5
	backoff := 1 * time.Second

	for i := 1; i <= maxAttempts; i++ {
		start := time.Now()

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, dest.URL, bytes.NewReader(body))
		if err != nil {
			log.Error().Err(err).Str("url", dest.URL).Msg("failed to create webhook request")
			_ = s.store.RecordAlertDelivery(ctx, store.AlertDelivery{
				TenantID:      tenantID,
				DestinationID: dest.ID,
				AlertID:       alertID,
				Event:         string(event),
				Attempt:       i,
				Success:       false,
				DurationMs:    int(time.Since(start).Milliseconds()),
				Error:         err.Error(),
			})
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "SNMP-Poller-Notifier/1.1")

		resp, doErr := client.Do(req)
		durMs := int(time.Since(start).Milliseconds())
		statusCode := 0
		success := false
		errMsg := ""

		if doErr != nil {
			errMsg = doErr.Error()
		} else {
			statusCode = resp.StatusCode
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			success = statusCode >= 200 && statusCode < 300
			if !success {
				errMsg = resp.Status
			}
		}

		sc := statusCode
		if statusCode == 0 {
			sc = 0
		}
		_ = s.store.RecordAlertDelivery(ctx, store.AlertDelivery{
			TenantID:      tenantID,
			DestinationID: dest.ID,
			AlertID:       alertID,
			Event:         string(event),
			Attempt:       i,
			StatusCode:    &sc,
			Success:       success,
			DurationMs:    durMs,
			Error:         errMsg,
		})

		if success {
			log.Info().Str("dest", dest.Name).Str("tenant_id", tenantID).Str("event", string(event)).Msg("webhook sent successfully")
			return
		}

		log.Warn().Str("dest", dest.Name).Str("tenant_id", tenantID).Str("event", string(event)).Int("attempt", i).Int("status", statusCode).Str("error", errMsg).Msg("webhook delivery failed")

		if i < maxAttempts {
			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff):
			}
			if backoff < 15*time.Second {
				backoff *= 2
			}
		}
	}
}
