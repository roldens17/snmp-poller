package server

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/fresatu/snmp-poller/internal/auth"
	"github.com/fresatu/snmp-poller/internal/store"
)

// userResolver is the minimal store interface required by authRequired.
// Keeping it narrow lets tests inject a stub without a real database.
type userResolver interface {
	GetUserByID(ctx context.Context, id string) (*store.User, error)
	GetUserTenants(ctx context.Context, userID string) ([]store.Tenant, error)
	GetTenantByID(ctx context.Context, id string) (*store.Tenant, error)
	ListAllTenants(ctx context.Context) ([]store.Tenant, error)
}

// resolveUserTenant enforces the tenant isolation invariant for regular users:
// a user may only access a tenant they are a member of.
// Returns the active tenant or an error string suitable for a 403 response.
func resolveUserTenant(tenants []store.Tenant, requestedID string) (*store.Tenant, string) {
	if len(tenants) == 0 {
		return nil, "no active tenant assigned"
	}
	if requestedID == "" {
		t := tenants[0]
		return &t, ""
	}
	for _, t := range tenants {
		if t.ID == requestedID {
			result := t
			return &result, ""
		}
	}
	return nil, "access restricted for this tenant"
}

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

func (s *HTTPServer) isSuperAdmin(user *store.User) bool {
	if user == nil {
		return false
	}
	raw := strings.TrimSpace(os.Getenv("SUPERADMIN_EMAILS"))
	if raw == "" {
		return false
	}
	email := strings.ToLower(strings.TrimSpace(user.Email))
	for _, it := range strings.Split(raw, ",") {
		if email == strings.ToLower(strings.TrimSpace(it)) {
			return true
		}
	}
	return false
}

func (s *HTTPServer) setAuthCookie(c *gin.Context, token string, maxAge int) {
	sameSite := http.SameSiteLaxMode
	switch s.auth.CookieSameSite() {
	case "strict":
		sameSite = http.SameSiteStrictMode
	case "none":
		sameSite = http.SameSiteNoneMode
	default:
		sameSite = http.SameSiteLaxMode
	}
	c.SetSameSite(sameSite)
	c.SetCookie(
		s.auth.CookieName(),
		token,
		maxAge,
		"/",
		s.auth.CookieDomain(),
		s.auth.CookieSecure(),
		s.auth.CookieHTTPOnly(),
	)
}

// authRequired middleware validates the session cookie and resolves the active tenant.
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

		user, err := s.userRes.GetUserByID(c.Request.Context(), claims.ID)
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
		tenants, err := s.userRes.GetUserTenants(c.Request.Context(), user.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve tenants"})
			c.Abort()
			return
		}

		// Determine Active Tenant
		var activeTenant *store.Tenant
		requestedTenantID := claims.TenantID
		super := s.isSuperAdmin(user)

		if super {
			if requestedTenantID != "" {
				t, err := s.userRes.GetTenantByID(c.Request.Context(), requestedTenantID)
				if err == nil {
					activeTenant = t
				}
			}
			if activeTenant == nil {
				all, err := s.userRes.ListAllTenants(c.Request.Context())
				if err != nil || len(all) == 0 {
					c.JSON(http.StatusForbidden, gin.H{"error": "no tenants available"})
					c.Abort()
					return
				}
				activeTenant = &all[0]
			}
		} else {
			var errMsg string
			activeTenant, errMsg = resolveUserTenant(tenants, requestedTenantID)
			if errMsg != "" {
				c.JSON(http.StatusForbidden, gin.H{"error": errMsg})
				c.Abort()
				return
			}
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
	if s.loginLimiter != nil {
		if !s.loginLimiter.Allow(c.ClientIP()) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many login attempts"})
			return
		}
	}

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
	// Prefer the configured default tenant slug when the user belongs to it.
	if slug := s.cfg.DefaultTenantSlug; slug != "" {
		for _, t := range tenants {
			if t.Slug == slug {
				initialTenantID = t.ID
				break
			}
		}
	}

	token, err := s.auth.CreateJWT(user.ID, user.Email, user.Role, initialTenantID)
	if err != nil {
		s.respondErr(c, err)
		return
	}

	s.setAuthCookie(c, token, int(s.auth.TokenTTL().Seconds()))
	tenantID := initialTenantID
	_ = s.store.AddAuditEvent(c.Request.Context(), tenantID, user.ID, "auth.login", "session", "", `{}`, c.ClientIP())
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
	resp := gin.H{"user": toAuthUserResponse(user), "is_superadmin": s.isSuperAdmin(user)}
	if tenant, ok := s.getAuthTenant(c); ok && tenant != nil {
		resp["tenant"] = tenant
	}
	c.JSON(http.StatusOK, resp)
}

func slugifyTenantName(name string) string {
	slug := strings.ToLower(strings.TrimSpace(name))
	slug = strings.ReplaceAll(slug, "_", "-")
	slug = strings.ReplaceAll(slug, " ", "-")
	var b strings.Builder
	prevDash := false
	for _, r := range slug {
		ok := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-'
		if !ok {
			continue
		}
		if r == '-' {
			if prevDash {
				continue
			}
			prevDash = true
		} else {
			prevDash = false
		}
		b.WriteRune(r)
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		out = "tenant"
	}
	return out
}

func uniqueTenantSlug(ctx *gin.Context, s *HTTPServer, base string) (string, error) {
	base = slugifyTenantName(base)
	for i := 0; i < 20; i++ {
		candidate := base
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", base, i+1)
		}
		_, err := s.store.GetTenantBySlug(ctx.Request.Context(), candidate)
		if errors.Is(err, pgx.ErrNoRows) {
			return candidate, nil
		}
		if err != nil {
			return "", err
		}
	}
	return "", errors.New("unable to allocate unique tenant slug")
}

func (s *HTTPServer) handleAuthRegister(c *gin.Context) {
	if !s.cfg.Auth.AllowRegister {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var req struct {
		Email      string `json:"email"`
		Password   string `json:"password"`
		Name       string `json:"name"`
		TenantName string `json:"tenant_name"`
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

	// Tenant assignment: create org if provided, otherwise assign to default tenant.
	var assignedTenantID string
	tenantName := strings.TrimSpace(req.TenantName)
	if tenantName != "" {
		slug, err := uniqueTenantSlug(c, s, tenantName)
		if err != nil {
			s.respondErr(c, err)
			return
		}
		tenant, err := s.store.CreateTenant(c.Request.Context(), tenantName, slug)
		if err != nil {
			s.respondErr(c, err)
			return
		}
		if err := s.store.AddUserToTenant(c.Request.Context(), user.ID, tenant.ID, "owner"); err != nil {
			s.respondErr(c, err)
			return
		}
		assignedTenantID = tenant.ID
	} else {
		defaultSlug := s.cfg.DefaultTenantSlug
		if strings.TrimSpace(defaultSlug) == "" {
			defaultSlug = "default"
		}
		tenant, err := s.store.GetTenantBySlug(c.Request.Context(), defaultSlug)
		if err == nil {
			_ = s.store.AddUserToTenant(c.Request.Context(), user.ID, tenant.ID, "owner")
			assignedTenantID = tenant.ID
		}
	}

	c.JSON(http.StatusCreated, gin.H{"ok": true, "user": toAuthUserResponse(user), "tenant_id": assignedTenantID})
}

func (s *HTTPServer) handleAuthRegisterInvite(c *gin.Context) {
	var req struct {
		Token    string `json:"token"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" || strings.TrimSpace(req.Password) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token and password required"})
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

	email := strings.TrimSpace(strings.ToLower(inv.Email))
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invite missing email"})
		return
	}
	if _, err := s.store.GetUserByEmail(c.Request.Context(), email); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "account already exists; login then accept invite"})
		return
	} else if !errors.Is(err, pgx.ErrNoRows) {
		s.respondErr(c, err)
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	user, err := s.store.CreateUser(c.Request.Context(), email, hash, req.Name, inv.Role)
	if err != nil {
		s.respondErr(c, err)
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

	token, err := s.auth.CreateJWT(user.ID, user.Email, user.Role, inv.TenantID)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	s.setAuthCookie(c, token, int(s.auth.TokenTTL().Seconds()))
	_ = s.store.AddAuditEvent(c.Request.Context(), inv.TenantID, user.ID, "invite.accept", "tenant_invite", inv.ID, `{}`, c.ClientIP())
	c.JSON(http.StatusCreated, gin.H{"ok": true, "user": toAuthUserResponse(user), "tenant_id": inv.TenantID})
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

	var targetTenant *store.Tenant
	if s.isSuperAdmin(user) {
		t, err := s.store.GetTenantByID(c.Request.Context(), req.TenantID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusNotFound, gin.H{"error": "tenant not found"})
				return
			}
			s.respondErr(c, err)
			return
		}
		targetTenant = t
	} else {
		// Verify membership
		tenants, err := s.store.GetUserTenants(c.Request.Context(), user.ID)
		if err != nil {
			s.respondErr(c, err)
			return
		}
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
	}

	// Issue new token
	token, err := s.auth.CreateJWT(user.ID, user.Email, user.Role, targetTenant.ID)
	if err != nil {
		s.respondErr(c, err)
		return
	}

	s.setAuthCookie(c, token, int(s.auth.TokenTTL().Seconds()))
	_ = s.store.AddAuditEvent(c.Request.Context(), targetTenant.ID, user.ID, "tenant.switch", "tenant", targetTenant.ID, `{}`, c.ClientIP())
	c.JSON(http.StatusOK, gin.H{"tenant": targetTenant})
}
