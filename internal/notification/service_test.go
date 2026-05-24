package notification

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/fresatu/snmp-poller/internal/store"
)


// --- buildPayload ---

func baseAlert() store.Alert {
	now := time.Date(2024, 6, 1, 12, 0, 0, 0, time.UTC)
	return store.Alert{
		ID:          42,
		DeviceID:    7,
		Severity:    "warning",
		Message:     "eth0 down for 3m0s",
		TriggeredAt: now,
	}
}

func TestBuildPayload_Fields(t *testing.T) {
	alert := baseAlert()
	p := buildPayload("https://dash.example.com", "tenant-1", EventAlertCreated, alert)

	if p.Tenant.ID != "tenant-1" {
		t.Errorf("Tenant.ID: got %q", p.Tenant.ID)
	}
	if p.Event != EventAlertCreated {
		t.Errorf("Event: got %q", p.Event)
	}
	if p.Alert.ID != 42 {
		t.Errorf("Alert.ID: got %d", p.Alert.ID)
	}
	if p.Alert.DeviceID != 7 {
		t.Errorf("Alert.DeviceID: got %d", p.Alert.DeviceID)
	}
	if p.Alert.Severity != "warning" {
		t.Errorf("Alert.Severity: got %q", p.Alert.Severity)
	}
	if p.Alert.Message != "eth0 down for 3m0s" {
		t.Errorf("Alert.Message: got %q", p.Alert.Message)
	}
	if p.Links.Dashboard != "https://dash.example.com/alerts" {
		t.Errorf("Links.Dashboard: got %q", p.Links.Dashboard)
	}
}

func TestBuildPayload_TextFormat(t *testing.T) {
	alert := baseAlert()
	p := buildPayload("", "tenant-1", EventAlertCreated, alert)
	want := "[alert.created] Device 7 - eth0 down for 3m0s"
	if p.Text != want {
		t.Errorf("Text: got %q, want %q", p.Text, want)
	}
}

func TestBuildPayload_DashboardURLFallback(t *testing.T) {
	p := buildPayload("", "t", EventAlertCreated, baseAlert())
	if p.Links.Dashboard != "http://localhost:3000/alerts" {
		t.Errorf("expected fallback dashboard URL, got %q", p.Links.Dashboard)
	}
}

func TestBuildPayload_ResolvedAtNilForActiveAlert(t *testing.T) {
	alert := baseAlert() // ResolvedAt is nil
	p := buildPayload("", "t", EventAlertCreated, alert)
	if p.Alert.ResolvedAt != nil {
		t.Error("ResolvedAt should be nil for an active alert")
	}
}

func TestBuildPayload_ResolvedAtSetForResolvedAlert(t *testing.T) {
	alert := baseAlert()
	resolved := time.Now()
	alert.ResolvedAt = &resolved
	p := buildPayload("", "t", EventAlertResolved, alert)
	if p.Alert.ResolvedAt == nil {
		t.Error("ResolvedAt should be set for a resolved alert")
	}
}

func TestBuildPayload_SerializesCleanlyToJSON(t *testing.T) {
	p := buildPayload("https://dash.example.com", "tenant-1", EventAlertCreated, baseAlert())
	b, err := json.Marshal(p)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}
	var roundTrip WebhookPayload
	if err := json.Unmarshal(b, &roundTrip); err != nil {
		t.Fatalf("json.Unmarshal failed: %v", err)
	}
	if roundTrip.Alert.ID != p.Alert.ID {
		t.Errorf("round-trip Alert.ID: got %d, want %d", roundTrip.Alert.ID, p.Alert.ID)
	}
}

// --- sendWebhook ---

// noopRecorder satisfies deliveryRecorder without a real DB.
type noopRecorder struct {
	deliveries []store.AlertDelivery
}

func (r *noopRecorder) RecordAlertDelivery(_ context.Context, d store.AlertDelivery) error {
	r.deliveries = append(r.deliveries, d)
	return nil
}

func testSvc() *Service {
	return &Service{initialBackoff: 0} // zero backoff for fast retries in tests
}

func TestSendWebhook_SuccessOn2xx(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	rec := &noopRecorder{}
	dest := store.AlertDestination{ID: "d1", URL: srv.URL}
	body, _ := json.Marshal(WebhookPayload{})

	testSvc().sendWebhook(context.Background(), "t1", EventAlertCreated, 1, dest, body, rec)

	if len(rec.deliveries) != 1 {
		t.Fatalf("expected 1 delivery record, got %d", len(rec.deliveries))
	}
	if !rec.deliveries[0].Success {
		t.Error("expected delivery to be marked successful")
	}
	if rec.deliveries[0].Attempt != 1 {
		t.Errorf("expected attempt 1, got %d", rec.deliveries[0].Attempt)
	}
}

func TestSendWebhook_RetriesOnNon2xx(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	rec := &noopRecorder{}
	dest := store.AlertDestination{ID: "d1", URL: srv.URL}
	body, _ := json.Marshal(WebhookPayload{})

	testSvc().sendWebhook(context.Background(), "t1", EventAlertCreated, 1, dest, body, rec)

	if int(calls.Load()) != 5 {
		t.Errorf("expected 5 attempts (maxAttempts), got %d", calls.Load())
	}
	for _, d := range rec.deliveries {
		if d.Success {
			t.Error("no delivery should be marked successful on 500 responses")
		}
	}
}

func TestSendWebhook_StopsOnContextCancellation(t *testing.T) {
	// Server hangs indefinitely — the context timeout cancels the in-flight
	// HTTP request, which stops retries without waiting for backoff timers.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Long enough to ensure context cancellation fires before response,
		// short enough that server cleanup after the test is fast.
		time.Sleep(200 * time.Millisecond)
	}))
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	rec := &noopRecorder{}
	dest := store.AlertDestination{ID: "d1", URL: srv.URL}
	body, _ := json.Marshal(WebhookPayload{})

	svc := &Service{initialBackoff: time.Second}
	svc.sendWebhook(ctx, "t1", EventAlertCreated, 1, dest, body, rec)

	if len(rec.deliveries) >= 5 {
		t.Errorf("expected fewer than 5 delivery attempts after cancellation, got %d", len(rec.deliveries))
	}
}

func TestSendWebhook_RecordsCorrectHeaders(t *testing.T) {
	var gotContentType, gotUserAgent string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotContentType = r.Header.Get("Content-Type")
		gotUserAgent = r.Header.Get("User-Agent")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	rec := &noopRecorder{}
	dest := store.AlertDestination{ID: "d1", URL: srv.URL}
	body, _ := json.Marshal(WebhookPayload{})
	testSvc().sendWebhook(context.Background(), "t1", EventAlertCreated, 1, dest, body, rec)

	if gotContentType != "application/json" {
		t.Errorf("Content-Type: got %q, want application/json", gotContentType)
	}
	if gotUserAgent != "SNMP-Poller-Notifier/1.1" {
		t.Errorf("User-Agent: got %q", gotUserAgent)
	}
}
