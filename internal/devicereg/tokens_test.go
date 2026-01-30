package devicereg

import (
	"testing"
	"time"
)

func TestValidateDeviceTest(t *testing.T) {
	now := time.Now().UTC()
	fingerprint := "abc123"

	if err := ValidateDeviceTest(now.Add(5*time.Minute), fingerprint, fingerprint, now); err != nil {
		t.Fatalf("expected valid token: %v", err)
	}

	if err := ValidateDeviceTest(now.Add(-time.Minute), fingerprint, fingerprint, now); err == nil {
		t.Fatalf("expected expired token error")
	}

	if err := ValidateDeviceTest(now.Add(5*time.Minute), fingerprint, "other", now); err == nil {
		t.Fatalf("expected mismatch error")
	}
}
