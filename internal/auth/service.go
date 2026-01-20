package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/fresatu/snmp-poller/internal/config"
)

const bcryptCost = 12

// Service handles JWT creation and cookie settings.
type Service struct {
	secret       []byte
	cookieName   string
	cookieSecure bool
	tokenTTL     time.Duration
}

// Claims captures the JWT payload for sessions.
type Claims struct {
	Email    string `json:"email"`
	Role     string `json:"role"`
	TenantID string `json:"tenant_id,omitempty"`
	jwt.RegisteredClaims
}

// UserClaims exposes parsed claims for downstream use.
type UserClaims struct {
	ID       string
	Email    string
	Role     string
	TenantID string
}

// NewService builds an auth service from config.
func NewService(cfg config.AuthConfig) *Service {
	ttl := cfg.TokenTTL.Duration
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}

	return &Service{
		secret:       []byte(cfg.JWTSecret),
		cookieName:   cfg.CookieName,
		cookieSecure: cfg.CookieSecureValue(),
		tokenTTL:     ttl,
	}
}

// CookieName returns the cookie name for sessions.
func (s *Service) CookieName() string {
	return s.cookieName
}

// CookieSecure returns the secure cookie flag.
func (s *Service) CookieSecure() bool {
	return s.cookieSecure
}

// TokenTTL returns the JWT TTL.
func (s *Service) TokenTTL() time.Duration {
	return s.tokenTTL
}

// HashPassword hashes a plaintext password using bcrypt.
func HashPassword(plain string) (string, error) {
	if plain == "" {
		return "", errors.New("password is empty")
	}
	bytes, err := bcrypt.GenerateFromPassword([]byte(plain), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// VerifyPassword compares a plaintext password to a bcrypt hash.
func VerifyPassword(plain, hash string) error {
	if plain == "" || hash == "" {
		return errors.New("password or hash empty")
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain))
}

// CreateJWT builds a signed JWT for the user.
func (s *Service) CreateJWT(userID, email, role, tenantID string) (string, error) {
	if len(s.secret) == 0 {
		return "", errors.New("jwt secret missing")
	}
	if userID == "" {
		return "", errors.New("user id missing")
	}
	if email == "" {
		return "", errors.New("email missing")
	}
	if role == "" {
		role = "owner"
	}
	if s.tokenTTL <= 0 {
		s.tokenTTL = 24 * time.Hour
	}

	now := time.Now()
	claims := Claims{
		Email:    email,
		Role:     role,
		TenantID: tenantID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.tokenTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secret)
}

// ParseJWT verifies and parses a JWT string.
func (s *Service) ParseJWT(token string) (*UserClaims, error) {
	if token == "" {
		return nil, errors.New("token missing")
	}

	parsed, err := jwt.ParseWithClaims(token, &Claims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return s.secret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, errors.New("invalid token")
	}
	if claims.Subject == "" {
		return nil, errors.New("missing subject")
	}

	return &UserClaims{
		ID:       claims.Subject,
		Email:    claims.Email,
		Role:     claims.Role,
		TenantID: claims.TenantID,
	}, nil
}
