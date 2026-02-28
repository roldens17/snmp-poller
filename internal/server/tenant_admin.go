package server

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (s *HTTPServer) addAudit(c *gin.Context, action, resource, resourceID string, metadata string) {
	user, _ := s.getAuthUser(c)
	tenant, _ := s.getAuthTenant(c)
	uid := ""
	tid := ""
	if user != nil {
		uid = user.ID
	}
	if tenant != nil {
		tid = tenant.ID
	}
	_ = s.store.AddAuditEvent(c.Request.Context(), tid, uid, action, resource, resourceID, metadata, c.ClientIP())
}

func (s *HTTPServer) handleListAudit(c *gin.Context) {
	tenantID := s.getTenantID(c)
	limit := 100
	if l := strings.TrimSpace(c.Query("limit")); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}
	events, err := s.store.ListAuditEvents(c.Request.Context(), tenantID, limit)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"events": events})
}

func (s *HTTPServer) handleListInvites(c *gin.Context) {
	tenantID := s.getTenantID(c)
	invites, err := s.store.ListInvites(c.Request.Context(), tenantID)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	for i := range invites {
		invites[i].Token = ""
	}
	c.JSON(http.StatusOK, gin.H{"invites": invites})
}

func (s *HTTPServer) handleCreateInvite(c *gin.Context) {
	var req struct {
		Email     string `json:"email"`
		Role      string `json:"role"`
		ExpiresIn int    `json:"expires_in_hours"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid email required"})
		return
	}
	role := strings.TrimSpace(strings.ToLower(req.Role))
	if role == "" {
		role = "viewer"
	}
	if role != "viewer" && role != "admin" && role != "owner" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role must be viewer|admin|owner"})
		return
	}
	if req.ExpiresIn <= 0 {
		req.ExpiresIn = 72
	}
	token, err := randomToken(24)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	user, _ := s.getAuthUser(c)
	tenantID := s.getTenantID(c)
	inv, err := s.store.CreateInvite(c.Request.Context(), tenantID, req.Email, role, token, user.ID, time.Now().Add(time.Duration(req.ExpiresIn)*time.Hour))
	if err != nil {
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "invite.create", "tenant_invite", inv.ID, fmt.Sprintf(`{"email":%q,"role":%q}`, inv.Email, inv.Role))

	inviteURL := ""
	if base := strings.TrimSpace(s.cfg.HTTP.DashboardBaseURL); base != "" {
		inviteURL = strings.TrimRight(base, "/") + "/accept-invite?token=" + token
	}

	c.JSON(http.StatusCreated, gin.H{
		"invite": inv,
		"accept": gin.H{"token": token, "url": inviteURL},
	})
}

func (s *HTTPServer) handleAcceptInvite(c *gin.Context) {
	var req struct {
		Token string `json:"token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token required"})
		return
	}
	inv, err := s.store.GetInviteByToken(c.Request.Context(), req.Token)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "invite not found"})
			return
		}
		s.respondErr(c, err)
		return
	}
	if inv.AcceptedAt != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "invite already used"})
		return
	}
	if time.Now().After(inv.ExpiresAt) {
		c.JSON(http.StatusGone, gin.H{"error": "invite expired"})
		return
	}
	user, ok := s.getAuthUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	if strings.ToLower(strings.TrimSpace(user.Email)) != strings.ToLower(strings.TrimSpace(inv.Email)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "invite email mismatch"})
		return
	}
	if err := s.store.AddUserToTenant(c.Request.Context(), user.ID, inv.TenantID, inv.Role); err != nil {
		s.respondErr(c, err)
		return
	}
	if err := s.store.MarkInviteAccepted(c.Request.Context(), inv.ID); err != nil {
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "invite.accept", "tenant_invite", inv.ID, fmt.Sprintf(`{"email":%q}`, inv.Email))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *HTTPServer) handleDeleteInvite(c *gin.Context) {
	tenantID := s.getTenantID(c)
	inviteID := c.Param("id")
	if strings.TrimSpace(inviteID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := s.store.DeleteInvite(c.Request.Context(), tenantID, inviteID); err != nil {
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "invite.delete", "tenant_invite", inviteID, "{}")
	c.Status(http.StatusNoContent)
}

func (s *HTTPServer) handleGetPlan(c *gin.Context) {
	tenant, ok := s.getAuthTenant(c)
	if !ok || tenant == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	count, err := s.store.CountDevices(c.Request.Context(), tenant.ID)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"tenant_id":      tenant.ID,
		"plan_code":      tenant.PlanCode,
		"billing_status": tenant.BillingStatus,
		"max_devices":    tenant.MaxDevices,
		"device_count":   count,
		"trial_ends_at":  tenant.TrialEndsAt,
	})
}

func (s *HTTPServer) handleUpdatePlan(c *gin.Context) {
	var req struct {
		PlanCode      string `json:"plan_code"`
		BillingStatus string `json:"billing_status"`
		MaxDevices    int    `json:"max_devices"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	tenant := s.getTenantID(c)
	if req.PlanCode == "" {
		req.PlanCode = "starter"
	}
	if req.BillingStatus == "" {
		req.BillingStatus = "active"
	}
	if req.MaxDevices <= 0 {
		req.MaxDevices = 100
	}
	if err := s.store.UpdateTenantPlan(c.Request.Context(), tenant, req.PlanCode, req.BillingStatus, req.MaxDevices); err != nil {
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "plan.update", "tenant", tenant, fmt.Sprintf(`{"plan_code":%q,"billing_status":%q,"max_devices":%d}`, req.PlanCode, req.BillingStatus, req.MaxDevices))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}


func (s *HTTPServer) handleListAlertDeliveries(c *gin.Context) {
	tenantID := s.getTenantID(c)
	limit := 100
	if l := strings.TrimSpace(c.Query("limit")); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}
	deliveries, err := s.store.ListAlertDeliveries(c.Request.Context(), tenantID, limit)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"deliveries": deliveries})
}


func (s *HTTPServer) handleAPIAlerts(c *gin.Context) {
	status := strings.TrimSpace(c.Query("status"))
	if status == "" {
		status = "active"
	}
	if status != "active" && status != "resolved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status must be active|resolved"})
		return
	}
	limit := 50
	if l := strings.TrimSpace(c.Query("limit")); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}
	tenantID := s.getTenantID(c)
	items, err := s.store.ListAlertsAPI(c.Request.Context(), tenantID, status, limit)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"alerts": items})
}

func (s *HTTPServer) handleTenantsOverview(c *gin.Context) {
	user, ok := s.getAuthUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	tens, err := s.store.GetUserTenants(c.Request.Context(), user.ID)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	ids := make([]string, 0, len(tens))
	for _, t := range tens {
		ids = append(ids, t.ID)
	}
	rows, err := s.store.TenantOverviewByIDs(c.Request.Context(), ids)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"tenants": rows})
}
