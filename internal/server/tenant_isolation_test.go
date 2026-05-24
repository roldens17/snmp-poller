package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"github.com/fresatu/snmp-poller/internal/auth"
	"github.com/fresatu/snmp-poller/internal/config"
	"github.com/fresatu/snmp-poller/internal/store"
)

// stubResolver is a test double for userResolver.
type stubResolver struct {
	user          *store.User
	userErr       error
	tenants       []store.Tenant
	tenantsErr    error
	tenant        *store.Tenant
	tenantErr     error
	allTenants    []store.Tenant
	allTenantsErr error
}

func (s *stubResolver) GetUserByID(_ context.Context, _ string) (*store.User, error) {
	return s.user, s.userErr
}

func (s *stubResolver) GetUserTenants(_ context.Context, _ string) ([]store.Tenant, error) {
	return s.tenants, s.tenantsErr
}

func (s *stubResolver) GetTenantByID(_ context.Context, _ string) (*store.Tenant, error) {
	return s.tenant, s.tenantErr
}

func (s *stubResolver) ListAllTenants(_ context.Context) ([]store.Tenant, error) {
	return s.allTenants, s.allTenantsErr
}

// --- resolveUserTenant ---

func TestResolveUserTenant_EmptyTenants(t *testing.T) {
	tnt, msg := resolveUserTenant(nil, "")
	if tnt != nil || msg == "" {
		t.Errorf("expected nil tenant and error msg, got tenant=%v msg=%q", tnt, msg)
	}
}

func TestResolveUserTenant_NoRequestedID(t *testing.T) {
	tenants := []store.Tenant{{ID: "t1"}, {ID: "t2"}}
	tnt, msg := resolveUserTenant(tenants, "")
	if tnt == nil || tnt.ID != "t1" || msg != "" {
		t.Errorf("expected first tenant t1, got %v msg=%q", tnt, msg)
	}
}

func TestResolveUserTenant_MatchFirst(t *testing.T) {
	tenants := []store.Tenant{{ID: "t1"}, {ID: "t2"}}
	tnt, msg := resolveUserTenant(tenants, "t1")
	if tnt == nil || tnt.ID != "t1" || msg != "" {
		t.Errorf("expected t1, got %v msg=%q", tnt, msg)
	}
}

func TestResolveUserTenant_MatchSecond(t *testing.T) {
	tenants := []store.Tenant{{ID: "t1"}, {ID: "t2"}}
	tnt, msg := resolveUserTenant(tenants, "t2")
	if tnt == nil || tnt.ID != "t2" || msg != "" {
		t.Errorf("expected t2, got %v msg=%q", tnt, msg)
	}
}

func TestResolveUserTenant_NoMatch(t *testing.T) {
	tenants := []store.Tenant{{ID: "t1"}}
	tnt, msg := resolveUserTenant(tenants, "t3")
	if tnt != nil || msg == "" {
		t.Errorf("expected nil tenant and error msg, got %v msg=%q", tnt, msg)
	}
}

// --- authRequired middleware ---

func newIsolationAuthSvc() *auth.Service {
	return auth.NewService(config.AuthConfig{
		JWTSecret:  "test-secret-32-bytes-long-enough!",
		TokenTTL:   config.Duration{Duration: time.Hour},
		CookieName: "snmpai_session",
	})
}

func newIsolationServer(res userResolver) *HTTPServer {
	return &HTTPServer{
		auth:    newIsolationAuthSvc(),
		userRes: res,
		cfg:     &config.Config{},
	}
}

func setupIsolationRouter(s *HTTPServer) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/ping", s.authRequired(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	return r
}

func TestAuthRequired_NoCookie(t *testing.T) {
	s := newIsolationServer(&stubResolver{})
	r := setupIsolationRouter(s)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthRequired_InvalidJWT(t *testing.T) {
	s := newIsolationServer(&stubResolver{})
	r := setupIsolationRouter(s)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.AddCookie(&http.Cookie{Name: s.auth.CookieName(), Value: "not-a-valid-jwt"})
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthRequired_UserNotFound(t *testing.T) {
	res := &stubResolver{userErr: pgx.ErrNoRows}
	s := newIsolationServer(res)
	r := setupIsolationRouter(s)

	token, _ := s.auth.CreateJWT("uid1", "user@example.com", "member", "t1")

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.AddCookie(&http.Cookie{Name: s.auth.CookieName(), Value: token})
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthRequired_NoTenants(t *testing.T) {
	user := &store.User{ID: "uid1", Email: "user@example.com", Role: "member"}
	res := &stubResolver{user: user, tenants: []store.Tenant{}}
	s := newIsolationServer(res)
	r := setupIsolationRouter(s)

	token, _ := s.auth.CreateJWT("uid1", "user@example.com", "member", "t1")

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.AddCookie(&http.Cookie{Name: s.auth.CookieName(), Value: token})
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestAuthRequired_WrongTenant(t *testing.T) {
	user := &store.User{ID: "uid1", Email: "user@example.com", Role: "member"}
	res := &stubResolver{
		user:    user,
		tenants: []store.Tenant{{ID: "t1", Name: "Tenant 1"}},
	}
	s := newIsolationServer(res)
	r := setupIsolationRouter(s)

	// JWT claims tenant t2 but user only belongs to t1
	token, _ := s.auth.CreateJWT("uid1", "user@example.com", "member", "t2")

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.AddCookie(&http.Cookie{Name: s.auth.CookieName(), Value: token})
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestAuthRequired_ValidRequest(t *testing.T) {
	user := &store.User{ID: "uid1", Email: "user@example.com", Role: "member"}
	res := &stubResolver{
		user:    user,
		tenants: []store.Tenant{{ID: "t1", Name: "Tenant 1"}},
	}
	s := newIsolationServer(res)
	r := setupIsolationRouter(s)

	token, _ := s.auth.CreateJWT("uid1", "user@example.com", "member", "t1")

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.AddCookie(&http.Cookie{Name: s.auth.CookieName(), Value: token})
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}
