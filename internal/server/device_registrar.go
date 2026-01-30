package server

import (
	"context"

	"github.com/fresatu/snmp-poller/internal/devicereg"
	"github.com/fresatu/snmp-poller/internal/store"
)

// DeviceRegistrar abstracts device registration logic for handler tests.
type DeviceRegistrar interface {
	TestSNMP(ctx context.Context, tenantID string, req devicereg.TestSNMPRequest) (*devicereg.TestSNMPResult, string, error)
	CreateDevice(ctx context.Context, tenantID string, req devicereg.CreateDeviceRequest) (*store.Device, error)
}
