package devicereg

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strings"
	"time"
)

// GenerateTestToken returns a URL-safe random token.
func GenerateTestToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

// FingerprintSNMPConfig hashes the config so secrets never persist directly.
func FingerprintSNMPConfig(ip string, snmp SNMPConfig) string {
	parts := []string{
		strings.TrimSpace(strings.ToLower(ip)),
		strings.TrimSpace(strings.ToLower(snmp.Version)),
		strings.TrimSpace(snmp.Community),
	}
	if snmp.V3 != nil {
		parts = append(parts,
			strings.TrimSpace(snmp.V3.Username),
			strings.TrimSpace(strings.ToUpper(snmp.V3.AuthProtocol)),
			strings.TrimSpace(snmp.V3.AuthPassword),
			strings.TrimSpace(strings.ToUpper(snmp.V3.PrivProtocol)),
			strings.TrimSpace(snmp.V3.PrivPassword),
		)
	}
	sum := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(sum[:])
}

// ValidateDeviceTest ensures a token is still usable for a given fingerprint.
func ValidateDeviceTest(expiresAt time.Time, fingerprint, expectedFingerprint string, now time.Time) error {
	if fingerprint != expectedFingerprint {
		return errors.New("snmp config mismatch")
	}
	if now.After(expiresAt) {
		return errors.New("snmp test token expired")
	}
	return nil
}
