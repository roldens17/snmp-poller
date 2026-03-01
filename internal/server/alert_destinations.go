package server

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/fresatu/snmp-poller/internal/store"
	"github.com/gin-gonic/gin"
)

func (s *HTTPServer) handleListAlertDestinations(c *gin.Context) {
	tenantID := s.getTenantID(c)
	dests, err := s.store.ListAlertDestinations(c.Request.Context(), tenantID)
	if err != nil {
		s.respondErr(c, err)
		return
	}

	// Redact URLs
	for i := range dests {
		dests[i].URL = redactURL(dests[i].URL)
	}

	c.JSON(http.StatusOK, gin.H{"destinations": dests})
}

func (s *HTTPServer) handleCreateAlertDestination(c *gin.Context) {
	var req struct {
		Type      string `json:"type" binding:"required"`
		Name      string `json:"name" binding:"required"`
		URL       string `json:"url" binding:"required"`
		IsEnabled bool   `json:"is_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Basic validation
	if req.Type != "webhook" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only 'webhook' type is supported"})
		return
	}
	if !strings.HasPrefix(req.URL, "https://") && !s.cfg.DemoMode {
		c.JSON(http.StatusBadRequest, gin.H{"error": "url must start with https://"})
		return
	}

	tenantID := s.getTenantID(c)
	dest := &store.AlertDestination{
		TenantID:  tenantID,
		Type:      req.Type,
		Name:      req.Name,
		URL:       req.URL,
		IsEnabled: req.IsEnabled,
	}

	if err := s.store.CreateAlertDestination(c.Request.Context(), dest); err != nil {
		s.respondErr(c, err)
		return
	}

	// Return created (with redacted URL so UI logic remains consistent, though we just sent it)
	// Actually better to return it as is or redacted? Usually API returns resource.
	// We won't redact it here immediately so the user confirms it was saved?
	// Recommendation says "redact". Let's redact it to be safe.
	dest.URL = redactURL(dest.URL)
	c.JSON(http.StatusCreated, dest)
}

func (s *HTTPServer) handleUpdateAlertDestination(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Name      string `json:"name"`
		URL       string `json:"url"`
		IsEnabled *bool  `json:"is_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	tenantID := s.getTenantID(c)
	// We need to fetch it first to ensure ownership and partial updates (if we supported PATCH nicely)
	// But update query uses ID+TenantID so strictly speaking we are safe.
	// But to support partial updates without fetching, we need to know what fields to update.
	// The store method UpdateAlertDestination expects a full struct usually or we assume full update.
	// My store method updates (Name, URL, IsEnabled). If URL is empty, we shouldn't overwrite it if the user just wanted to toggle?
	// Let's implement full update PUT semantics for simplicity or fetch-merge-save.
	// Let's do simple fetch-merge-save.

	dests, err := s.store.ListAlertDestinations(c.Request.Context(), tenantID)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	var existing *store.AlertDestination
	for i := range dests {
		if dests[i].ID == id {
			existing = &dests[i]
			break
		}
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.URL != "" {
		existing.URL = req.URL
	}
	if req.IsEnabled != nil {
		existing.IsEnabled = *req.IsEnabled
	}

	// Validate URL if changed
	if req.URL != "" {
		if !strings.HasPrefix(existing.URL, "https://") && !s.cfg.DemoMode {
			c.JSON(http.StatusBadRequest, gin.H{"error": "url must start with https://"})
			return
		}
	}

	if err := s.store.UpdateAlertDestination(c.Request.Context(), existing); err != nil {
		s.respondErr(c, err)
		return
	}
	existing.URL = redactURL(existing.URL)
	c.JSON(http.StatusOK, existing)
}

func (s *HTTPServer) handleDeleteAlertDestination(c *gin.Context) {
	id := c.Param("id")
	tenantID := s.getTenantID(c)
	if err := s.store.DeleteAlertDestination(c.Request.Context(), tenantID, id); err != nil {
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func redactURL(u string) string {
	if len(u) < 10 {
		return "..."
	}
	return u[:8] + "..." + u[len(u)-4:]
}


func (s *HTTPServer) handleTestAlertDestination(c *gin.Context) {
	id := c.Param("id")
	tenantID := s.getTenantID(c)
	dests, err := s.store.ListAlertDestinations(c.Request.Context(), tenantID)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	var dest *store.AlertDestination
	for i := range dests {
		if dests[i].ID == id {
			d := dests[i]
			dest = &d
			break
		}
	}
	if dest == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	payload := map[string]any{
		"text":      "SNMP SaaS webhook test ✅",
		"event":     "webhook.test",
		"message":   "SNMP SaaS webhook test",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"tenant_id": tenantID,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, dest.URL, bytes.NewReader(body))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid destination url"})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "SNMP-Poller-Test/1.0")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		_ = s.store.RecordAlertDelivery(c.Request.Context(), store.AlertDelivery{TenantID: tenantID, DestinationID: dest.ID, AlertID: 0, Event: "webhook.test", Attempt: 1, Success: false, DurationMs: 0, Error: err.Error()})
		c.JSON(http.StatusBadGateway, gin.H{"ok": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	sc := resp.StatusCode
	success := sc >= 200 && sc < 300
	_ = s.store.RecordAlertDelivery(c.Request.Context(), store.AlertDelivery{TenantID: tenantID, DestinationID: dest.ID, AlertID: 0, Event: "webhook.test", Attempt: 1, StatusCode: &sc, Success: success, DurationMs: 0, Error: ""})

	if !success {
		errText := strings.TrimSpace(string(respBody))
		if errText == "" { errText = http.StatusText(sc) }
		_ = s.store.RecordAlertDelivery(c.Request.Context(), store.AlertDelivery{TenantID: tenantID, DestinationID: dest.ID, AlertID: 0, Event: "webhook.test", Attempt: 1, StatusCode: &sc, Success: false, DurationMs: 0, Error: errText})
		c.JSON(http.StatusBadGateway, gin.H{"ok": false, "status": sc, "error": errText})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "status": sc})
}
