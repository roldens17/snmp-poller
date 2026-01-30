package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/fresatu/snmp-poller/internal/devicereg"
	"github.com/fresatu/snmp-poller/internal/store"
)

type stubDeviceRegistrar struct {
	createErr error
}

func (s stubDeviceRegistrar) TestSNMP(ctx context.Context, tenantID string, req devicereg.TestSNMPRequest) (*devicereg.TestSNMPResult, string, error) {
	return nil, "", nil
}

func (s stubDeviceRegistrar) CreateDevice(ctx context.Context, tenantID string, req devicereg.CreateDeviceRequest) (*store.Device, error) {
	return nil, s.createErr
}

func TestHandleCreateDevice_DeviceExists(t *testing.T) {
	gin.SetMode(gin.TestMode)
	srv := &HTTPServer{
		deviceReg: stubDeviceRegistrar{
			createErr: &devicereg.DeviceExistsError{DeviceID: 42, IP: "10.0.0.1"},
		},
	}

	router := gin.New()
	router.POST("/api/devices", func(c *gin.Context) {
		c.Set(authTenantContextKey, &store.Tenant{ID: "tenant-123"})
		srv.handleCreateDevice(c)
	})

	body := map[string]any{
		"device_name":    "edge-1",
		"ip_or_hostname": "10.0.0.1",
		"device_type":    "switch",
		"snmp": map[string]any{
			"version":   "2c",
			"community": "public",
		},
		"test_token": "token",
	}
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/devices", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected status %d got %d", http.StatusConflict, rec.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["error_code"] != "DEVICE_EXISTS" {
		t.Fatalf("expected error_code DEVICE_EXISTS, got %v", resp["error_code"])
	}
	if resp["device_id"] != float64(42) {
		t.Fatalf("expected device_id 42, got %v", resp["device_id"])
	}
}
