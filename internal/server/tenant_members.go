package server

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func (s *HTTPServer) handleListTenantMembers(c *gin.Context) {
	tenantID := s.getTenantID(c)
	members, err := s.store.ListTenantMembers(c.Request.Context(), tenantID)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"members": members})
}

func (s *HTTPServer) handleUpdateTenantMemberRole(c *gin.Context) {
	tenantID := s.getTenantID(c)
	userID := strings.TrimSpace(c.Param("userId"))
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user id required"})
		return
	}
	var req struct { Role string `json:"role"` }
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	role := strings.ToLower(strings.TrimSpace(req.Role))
	if role != "viewer" && role != "admin" && role != "owner" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role must be viewer|admin|owner"})
		return
	}
	if err := s.store.UpdateTenantMemberRole(c.Request.Context(), tenantID, userID, role); err != nil {
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "tenant.member.role", "tenant", tenantID, `{"user_id":"`+userID+`","role":"`+role+`"}`)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *HTTPServer) handleRemoveTenantMember(c *gin.Context) {
	tenantID := s.getTenantID(c)
	userID := strings.TrimSpace(c.Param("userId"))
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user id required"})
		return
	}
	user, _ := s.getAuthUser(c)
	if user != nil && user.ID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot remove yourself"})
		return
	}
	if err := s.store.RemoveTenantMember(c.Request.Context(), tenantID, userID); err != nil {
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "tenant.member.remove", "tenant", tenantID, `{"user_id":"`+userID+`"}`)
	c.Status(http.StatusNoContent)
}
