package server

import (
	"net/http"
	"strings"

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
