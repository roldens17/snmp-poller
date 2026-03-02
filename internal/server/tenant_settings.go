package server

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

var slugCleaner = regexp.MustCompile(`[^a-z0-9-]+`)

func normalizeTenantSlug(in string) string {
	s := strings.ToLower(strings.TrimSpace(in))
	s = strings.ReplaceAll(s, " ", "-")
	s = slugCleaner.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	for strings.Contains(s, "--") {
		s = strings.ReplaceAll(s, "--", "-")
	}
	return s
}

func (s *HTTPServer) handleUpdateActiveTenant(c *gin.Context) {
	tenant, ok := s.getAuthTenant(c)
	if !ok || tenant == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = tenant.Name
	}
	slug := normalizeTenantSlug(req.Slug)
	if slug == "" {
		slug = normalizeTenantSlug(tenant.Slug)
	}
	if name == "" || slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and slug are required"})
		return
	}

	if err := s.store.UpdateTenantProfile(c.Request.Context(), tenant.ID, name, slug); err != nil {
		s.respondErr(c, err)
		return
	}
	t2, err := s.store.GetTenantByID(c.Request.Context(), tenant.ID)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "tenant.update", "tenant", tenant.ID, `{"fields":["name","slug"]}`)
	c.JSON(http.StatusOK, gin.H{"tenant": t2})
}
