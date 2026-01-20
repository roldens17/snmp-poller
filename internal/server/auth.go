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

const authUserContextKey = "auth_user"

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

		c.Set(authUserContextKey, user)
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

	token, err := s.auth.CreateJWT(user.ID, user.Email, user.Role)
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

	c.JSON(http.StatusCreated, gin.H{"ok": true, "user": toAuthUserResponse(user)})
}
