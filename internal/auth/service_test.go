package auth

import (
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/fresatu/snmp-poller/internal/config"
)

// newTestService creates an auth service with a fixed secret for testing.
func newTestService(ttl time.Duration) *Service {
	return NewService(config.AuthConfig{
		JWTSecret: "test-secret-32-bytes-long-enough!",
		TokenTTL:  config.Duration{Duration: ttl},
	})
}

// --- HashPassword ---

func TestHashPassword_ProducesBcryptHash(t *testing.T) {
	hash, err := HashPassword("correct-horse-battery-staple")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.HasPrefix(hash, "$2a$") && !strings.HasPrefix(hash, "$2b$") {
		t.Errorf("expected bcrypt hash, got %q", hash)
	}
}

func TestHashPassword_EmptyPasswordReturnsError(t *testing.T) {
	_, err := HashPassword("")
	if err == nil {
		t.Error("expected error for empty password")
	}
}

func TestHashPassword_SamePasswordProducesDifferentHashes(t *testing.T) {
	h1, _ := HashPassword("password")
	h2, _ := HashPassword("password")
	if h1 == h2 {
		t.Error("bcrypt should produce different hashes for same password (different salts)")
	}
}

// --- VerifyPassword ---

func TestVerifyPassword_CorrectPasswordMatches(t *testing.T) {
	hash, _ := HashPassword("s3cr3t!")
	if err := VerifyPassword("s3cr3t!", hash); err != nil {
		t.Errorf("expected match, got error: %v", err)
	}
}

func TestVerifyPassword_WrongPasswordFails(t *testing.T) {
	hash, _ := HashPassword("s3cr3t!")
	if err := VerifyPassword("wrong", hash); err == nil {
		t.Error("expected mismatch error")
	}
}

func TestVerifyPassword_EmptyPasswordReturnsError(t *testing.T) {
	hash, _ := HashPassword("s3cr3t!")
	if err := VerifyPassword("", hash); err == nil {
		t.Error("expected error for empty password")
	}
}

func TestVerifyPassword_EmptyHashReturnsError(t *testing.T) {
	if err := VerifyPassword("s3cr3t!", ""); err == nil {
		t.Error("expected error for empty hash")
	}
}

// --- CreateJWT ---

func TestCreateJWT_ValidInputsReturnToken(t *testing.T) {
	svc := newTestService(time.Hour)
	tok, err := svc.CreateJWT("user-1", "user@example.com", "owner", "tenant-abc")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tok == "" {
		t.Error("expected non-empty token")
	}
}

func TestCreateJWT_MissingSecretReturnsError(t *testing.T) {
	svc := NewService(config.AuthConfig{JWTSecret: ""})
	_, err := svc.CreateJWT("user-1", "user@example.com", "owner", "")
	if err == nil {
		t.Error("expected error when JWT secret is empty")
	}
}

func TestCreateJWT_MissingUserIDReturnsError(t *testing.T) {
	svc := newTestService(time.Hour)
	_, err := svc.CreateJWT("", "user@example.com", "owner", "")
	if err == nil {
		t.Error("expected error when user ID is empty")
	}
}

func TestCreateJWT_MissingEmailReturnsError(t *testing.T) {
	svc := newTestService(time.Hour)
	_, err := svc.CreateJWT("user-1", "", "owner", "")
	if err == nil {
		t.Error("expected error when email is empty")
	}
}

func TestCreateJWT_EmptyRoleDefaultsToOwner(t *testing.T) {
	svc := newTestService(time.Hour)
	tok, err := svc.CreateJWT("user-1", "user@example.com", "", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	claims, err := svc.ParseJWT(tok)
	if err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if claims.Role != "owner" {
		t.Errorf("expected default role 'owner', got %q", claims.Role)
	}
}

// --- ParseJWT ---

func TestParseJWT_RoundTrip(t *testing.T) {
	svc := newTestService(time.Hour)
	tok, _ := svc.CreateJWT("user-42", "alice@example.com", "admin", "tenant-xyz")
	claims, err := svc.ParseJWT(tok)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if claims.ID != "user-42" {
		t.Errorf("ID: got %q, want %q", claims.ID, "user-42")
	}
	if claims.Email != "alice@example.com" {
		t.Errorf("Email: got %q, want %q", claims.Email, "alice@example.com")
	}
	if claims.Role != "admin" {
		t.Errorf("Role: got %q, want %q", claims.Role, "admin")
	}
	if claims.TenantID != "tenant-xyz" {
		t.Errorf("TenantID: got %q, want %q", claims.TenantID, "tenant-xyz")
	}
}

func TestParseJWT_EmptyTokenReturnsError(t *testing.T) {
	svc := newTestService(time.Hour)
	_, err := svc.ParseJWT("")
	if err == nil {
		t.Error("expected error for empty token")
	}
}

func TestParseJWT_TamperedTokenReturnsError(t *testing.T) {
	svc := newTestService(time.Hour)
	tok, _ := svc.CreateJWT("user-1", "user@example.com", "owner", "")
	// flip the last character to tamper with the signature
	tampered := tok[:len(tok)-1] + "X"
	_, err := svc.ParseJWT(tampered)
	if err == nil {
		t.Error("expected error for tampered token")
	}
}

func TestParseJWT_WrongSecretReturnsError(t *testing.T) {
	svcA := newTestService(time.Hour)
	svcB := NewService(config.AuthConfig{
		JWTSecret: "completely-different-secret-here",
		TokenTTL:  config.Duration{Duration: time.Hour},
	})
	tok, _ := svcA.CreateJWT("user-1", "user@example.com", "owner", "")
	_, err := svcB.ParseJWT(tok)
	if err == nil {
		t.Error("expected error when parsing token signed with different secret")
	}
}

func TestParseJWT_ExpiredTokenReturnsError(t *testing.T) {
	svc := newTestService(time.Hour)
	// Manually craft a token with an expiry in the past, bypassing NewService TTL clamping.
	past := time.Now().Add(-time.Hour)
	claims := Claims{
		Email: "user@example.com",
		Role:  "owner",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "user-1",
			IssuedAt:  jwt.NewNumericDate(past.Add(-time.Hour)),
			ExpiresAt: jwt.NewNumericDate(past),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tok, err := token.SignedString(svc.secret)
	if err != nil {
		t.Fatalf("sign error: %v", err)
	}
	_, err = svc.ParseJWT(tok)
	if err == nil {
		t.Error("expected error for expired token")
	}
}

func TestParseJWT_WrongSigningMethodReturnsError(t *testing.T) {
	// Manually craft a token using RS256 header to trigger the method check
	svc := newTestService(time.Hour)
	claims := Claims{
		Email: "user@example.com",
		Role:  "owner",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "user-1",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	// Use None method — the library will reject it during parse
	token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
	tok, _ := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	_, err := svc.ParseJWT(tok)
	if err == nil {
		t.Error("expected error for token with unexpected signing method")
	}
}
