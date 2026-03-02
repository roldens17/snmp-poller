package server

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func (s *HTTPServer) handleCreateTenant(c *gin.Context) {
	user, ok := s.getAuthUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		Name       string `json:"name"`
		Slug       string `json:"slug"`
		AutoSwitch *bool  `json:"auto_switch"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}

	slug := normalizeTenantSlug(req.Slug)
	if slug == "" {
		slug = normalizeTenantSlug(name)
	}
	if slug == "" {
		slug = "tenant"
	}

	base := slug
	for i := 0; i < 20; i++ {
		candidate := base
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", base, i+1)
		}
		_, err := s.store.GetTenantBySlug(c.Request.Context(), candidate)
		if errors.Is(err, pgx.ErrNoRows) {
			slug = candidate
			break
		}
		if err != nil {
			s.respondErr(c, err)
			return
		}
	}

	tenant, err := s.store.CreateTenant(c.Request.Context(), name, slug)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	if err := s.store.AddUserToTenant(c.Request.Context(), user.ID, tenant.ID, "owner"); err != nil {
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "tenant.create", "tenant", tenant.ID, fmt.Sprintf(`{"name":%q,"slug":%q}`, tenant.Name, tenant.Slug))

	autoSwitch := req.AutoSwitch == nil || *req.AutoSwitch
	if autoSwitch {
		token, err := s.auth.CreateJWT(user.ID, user.Email, user.Role, tenant.ID)
		if err == nil {
			s.setAuthCookie(c, token, int(s.auth.TokenTTL().Seconds()))
		}
	}

	c.JSON(http.StatusCreated, gin.H{"tenant": tenant, "switched": autoSwitch})
}
