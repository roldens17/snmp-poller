package server

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/fresatu/snmp-poller/internal/auth"
	"github.com/fresatu/snmp-poller/internal/store"
)

// authUserContextKey is used to store the authenticated user.
const authUserContextKey = "auth_user"
const authTenantContextKey = "auth_tenant"

// authUserResponse is the public user payload.
type authUserResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

func toAuthUserResponse(u *store.User) authUserResponse {
	return authUserResponse{
		ID:    u.ID,
		Email: u.Email,
		Name:  u.Name,
		Role:  u.Role,
	}
}

func (s *HTTPServer) setAuthCookie(c *gin.Context, token string, maxAge int) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(s.auth.CookieName(), token, maxAge, "/", "", s.auth.CookieSecure(), true)
}

// authRequired middleware ...
func (s *HTTPServer) authRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		cookie, err := c.Cookie(s.auth.CookieName())
		if err != nil || cookie == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		claims, err := s.auth.ParseJWT(cookie)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		user, err := s.store.GetUserByID(c.Request.Context(), claims.ID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
				c.Abort()
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal"})
			c.Abort()
			return
		}

		// Resolve Tenant
		tenants, err := s.store.GetUserTenants(c.Request.Context(), user.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve tenants"})
			c.Abort()
			return
		}
		if len(tenants) == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "no active tenant assigned"})
			c.Abort()
			return
		}

		// Determine Active Tenant
		var activeTenant *store.Tenant
		requestedTenantID := claims.TenantID

		if requestedTenantID != "" {
			// Validate membership
			for _, t := range tenants {
				if t.ID == requestedTenantID {
					activeTenant = &t
					break
				}
			}
			// If session tenant is invalid (removed from org?), return 403 or fallback?
			// Requirement: "Must not allow switching to tenant without membership."
			if activeTenant == nil {
				c.JSON(http.StatusForbidden, gin.H{"error": "access restricted for this tenant"})
				c.Abort()
				return
			}
		} else {
			// Fallback to first tenant
			activeTenant = &tenants[0]
		}

		c.Set(authUserContextKey, user)
		c.Set(authTenantContextKey, activeTenant)
		c.Next()
	}
}

func (s *HTTPServer) getAuthUser(c *gin.Context) (*store.User, bool) {
	val, ok := c.Get(authUserContextKey)
	if !ok {
		return nil, false
	}
	user, ok := val.(*store.User)
	return user, ok
}

func (s *HTTPServer) getAuthTenant(c *gin.Context) (*store.Tenant, bool) {
	val, ok := c.Get(authTenantContextKey)
	if !ok {
		return nil, false
	}
	tenant, ok := val.(*store.Tenant)
	return tenant, ok
}

func (s *HTTPServer) handleAuthLogin(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || strings.TrimSpace(req.Password) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password required"})
		return
	}

	user, err := s.store.GetUserByEmail(c.Request.Context(), req.Email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		s.respondErr(c, err)
		return
	}

	if err := auth.VerifyPassword(req.Password, user.PasswordHash); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Resolve initial tenant for session
	tenants, err := s.store.GetUserTenants(c.Request.Context(), user.ID)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	if len(tenants) == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "no tenant assigned"})
		return
	}
	initialTenantID := tenants[0].ID

	token, err := s.auth.CreateJWT(user.ID, user.Email, user.Role, initialTenantID)
	if err != nil {
		s.respondErr(c, err)
		return
	}

	s.setAuthCookie(c, token, int(s.auth.TokenTTL().Seconds()))
	c.JSON(http.StatusOK, gin.H{"ok": true, "user": toAuthUserResponse(user)})
}

func (s *HTTPServer) handleAuthLogout(c *gin.Context) {
	s.setAuthCookie(c, "", -1)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *HTTPServer) handleAuthMe(c *gin.Context) {
	user, ok := s.getAuthUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": toAuthUserResponse(user)})
}

func (s *HTTPServer) handleAuthRegister(c *gin.Context) {
	if !s.cfg.Auth.AllowRegister {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || strings.TrimSpace(req.Password) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password required"})
		return
	}

	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		s.respondErr(c, err)
		return
	}

	user, err := s.store.CreateUser(c.Request.Context(), req.Email, passwordHash, req.Name, "owner")
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
			return
		}
		s.respondErr(c, err)
		return
	}

	// For registration, we might not have a tenant yet, so we can't fully log them in with a valid tenant session.
	// Returning created user is fine. Login later will handle tenant resolution.
	c.JSON(http.StatusCreated, gin.H{"ok": true, "user": toAuthUserResponse(user)})
}

func (s *HTTPServer) handleGetActiveTenant(c *gin.Context) {
	tenant, ok := s.getAuthTenant(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"tenant": tenant})
}

func (s *HTTPServer) handleSwitchTenant(c *gin.Context) {
	user, ok := s.getAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		TenantID string `json:"tenant_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	if req.TenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id required"})
		return
	}

	// Verify membership
	tenants, err := s.store.GetUserTenants(c.Request.Context(), user.ID)
	if err != nil {
		s.respondErr(c, err)
		return
	}

	var targetTenant *store.Tenant
	for _, t := range tenants {
		if t.ID == req.TenantID {
			targetTenant = &t
			break
		}
	}

	if targetTenant == nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	// Issue new token
	token, err := s.auth.CreateJWT(user.ID, user.Email, user.Role, targetTenant.ID)
	if err != nil {
		s.respondErr(c, err)
		return
	}

	s.setAuthCookie(c, token, int(s.auth.TokenTTL().Seconds()))
	c.JSON(http.StatusOK, gin.H{"tenant": targetTenant})
}
