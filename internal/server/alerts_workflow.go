package server

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func parseAlertID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid alert id"})
		return 0, false
	}
	return id, true
}

func (s *HTTPServer) handleAcknowledgeAlert(c *gin.Context) {
	alertID, ok := parseAlertID(c)
	if !ok {
		return
	}
	var req struct {
		Note string `json:"note"`
	}
	_ = c.ShouldBindJSON(&req)
	tenantID := s.getTenantID(c)
	user, _ := s.getAuthUser(c)
	by := "system"
	if user != nil {
		by = user.Email
	}

	alert, err := s.store.AcknowledgeAlert(c.Request.Context(), tenantID, alertID, by, strings.TrimSpace(req.Note))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "alert not found"})
			return
		}
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "alert.acknowledge", "alert", fmt.Sprintf("%d", alertID), fmt.Sprintf(`{"by":%q}`, by))
	c.JSON(http.StatusOK, gin.H{"alert": alert})
}

func (s *HTTPServer) handleMuteAlert(c *gin.Context) {
	alertID, ok := parseAlertID(c)
	if !ok {
		return
	}
	var req struct {
		Minutes int `json:"minutes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if req.Minutes <= 0 {
		req.Minutes = 60
	}
	if req.Minutes > 7*24*60 {
		req.Minutes = 7 * 24 * 60
	}
	tenantID := s.getTenantID(c)
	user, _ := s.getAuthUser(c)
	by := "system"
	if user != nil {
		by = user.Email
	}
	alert, err := s.store.MuteAlert(c.Request.Context(), tenantID, alertID, by, req.Minutes)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "alert not found"})
			return
		}
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "alert.mute", "alert", fmt.Sprintf("%d", alertID), fmt.Sprintf(`{"minutes":%d,"by":%q}`, req.Minutes, by))
	c.JSON(http.StatusOK, gin.H{"alert": alert})
}

func (s *HTTPServer) handleAssignAlert(c *gin.Context) {
	alertID, ok := parseAlertID(c)
	if !ok {
		return
	}
	var req struct {
		Assignee string `json:"assignee"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	req.Assignee = strings.TrimSpace(req.Assignee)
	if req.Assignee == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "assignee required"})
		return
	}
	tenantID := s.getTenantID(c)
	alert, err := s.store.AssignAlert(c.Request.Context(), tenantID, alertID, req.Assignee)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "alert not found"})
			return
		}
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "alert.assign", "alert", fmt.Sprintf("%d", alertID), fmt.Sprintf(`{"assignee":%q}`, req.Assignee))
	c.JSON(http.StatusOK, gin.H{"alert": alert})
}

func (s *HTTPServer) handleCommentAlert(c *gin.Context) {
	alertID, ok := parseAlertID(c)
	if !ok {
		return
	}
	var req struct {
		Comment string `json:"comment"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	req.Comment = strings.TrimSpace(req.Comment)
	if req.Comment == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "comment required"})
		return
	}
	tenantID := s.getTenantID(c)
	user, _ := s.getAuthUser(c)
	by := "system"
	if user != nil {
		by = user.Email
	}
	alert, err := s.store.AddAlertComment(c.Request.Context(), tenantID, alertID, by, req.Comment)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "alert not found"})
			return
		}
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "alert.comment", "alert", fmt.Sprintf("%d", alertID), fmt.Sprintf(`{"by":%q,"comment":%q}`, by, req.Comment))
	c.JSON(http.StatusOK, gin.H{"alert": alert})
}

func (s *HTTPServer) handleResolveAlert(c *gin.Context) {
	alertID, ok := parseAlertID(c)
	if !ok {
		return
	}
	tenantID := s.getTenantID(c)
	alert, err := s.store.ResolveAlertByID(c.Request.Context(), tenantID, alertID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "alert not found"})
			return
		}
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "alert.resolve", "alert", fmt.Sprintf("%d", alertID), "{}")
	c.JSON(http.StatusOK, gin.H{"alert": alert})
}

func (s *HTTPServer) handleAlertTimeline(c *gin.Context) {
	alertID, ok := parseAlertID(c)
	if !ok {
		return
	}
	tenantID := s.getTenantID(c)
	limit := 100
	if l := strings.TrimSpace(c.Query("limit")); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}
	events, err := s.store.ListAuditEventsForResource(c.Request.Context(), tenantID, "alert", fmt.Sprintf("%d", alertID), limit)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"events": events})
}

func (s *HTTPServer) handleSimulateAlertDown(c *gin.Context) {
	var req struct {
		DeviceID int64  `json:"device_id"`
		Severity string `json:"severity"`
	}
	_ = c.ShouldBindJSON(&req)
	tenantID := s.getTenantID(c)
	deviceID := req.DeviceID
	if deviceID <= 0 {
		id, err := s.store.PickAnyDeviceID(c.Request.Context(), tenantID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "no devices found to simulate"})
				return
			}
			s.respondErr(c, err)
			return
		}
		deviceID = id
	}
	alert, err := s.store.SimulateDeviceDownAlert(c.Request.Context(), tenantID, deviceID, strings.TrimSpace(req.Severity))
	if err != nil {
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "alert.simulate_down", "alert", fmt.Sprintf("%d", alert.ID), fmt.Sprintf(`{"device_id":%d}`, deviceID))
	c.JSON(http.StatusOK, gin.H{"ok": true, "alert": alert})
}

func (s *HTTPServer) handleSimulateAlertRecover(c *gin.Context) {
	var req struct {
		DeviceID int64 `json:"device_id"`
	}
	_ = c.ShouldBindJSON(&req)
	tenantID := s.getTenantID(c)
	deviceID := req.DeviceID
	if deviceID <= 0 {
		id, err := s.store.PickAnyDeviceID(c.Request.Context(), tenantID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "no devices found to simulate"})
				return
			}
			s.respondErr(c, err)
			return
		}
		deviceID = id
	}
	if err := s.store.SimulateDeviceRecover(c.Request.Context(), tenantID, deviceID); err != nil {
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "alert.simulate_recover", "alert", "", fmt.Sprintf(`{"device_id":%d}`, deviceID))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
