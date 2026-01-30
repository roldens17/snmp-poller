package devicereg

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/fresatu/snmp-poller/internal/security"
	"github.com/fresatu/snmp-poller/internal/snmpclient"
	"github.com/fresatu/snmp-poller/internal/store"
)

const (
	defaultPollingIntervalSeconds = 60
	defaultTestTTL                = 10 * time.Minute
)

// Service coordinates device registration workflows.
type Service struct {
	store     *store.Store
	encryptor *security.Encryptor
	testTTL   time.Duration
}

// NewService constructs the device registration service.
func NewService(store *store.Store, encryptor *security.Encryptor) *Service {
	return &Service{
		store:     store,
		encryptor: encryptor,
		testTTL:   defaultTestTTL,
	}
}

// SNMPv3Config describes v3 credentials.
type SNMPv3Config struct {
	Username     string `json:"username"`
	AuthProtocol string `json:"auth_protocol"`
	AuthPassword string `json:"auth_password"`
	PrivProtocol string `json:"priv_protocol"`
	PrivPassword string `json:"priv_password"`
}

// SNMPConfig captures versioned SNMP settings.
type SNMPConfig struct {
	Version   string        `json:"version"`
	Community string        `json:"community,omitempty"`
	V3        *SNMPv3Config `json:"v3,omitempty"`
}

// TestSNMPRequest captures test inputs.
type TestSNMPRequest struct {
	IP   string     `json:"ip"`
	SNMP SNMPConfig `json:"snmp"`
}

// TestSNMPResult describes SNMP reachability details.
type TestSNMPResult struct {
	SysName          string
	InterfacesCount  int
	UptimeSeconds    int64
	SupportsMacTable bool
	Notes            []string
}

// CreateDeviceRequest captures device creation inputs.
type CreateDeviceRequest struct {
	DeviceName             string     `json:"device_name"`
	IPOrHostname           string     `json:"ip_or_hostname"`
	DeviceType             string     `json:"device_type"`
	SNMP                   SNMPConfig `json:"snmp"`
	PollingIntervalSeconds int        `json:"polling_interval_seconds"`
	Tags                   []string   `json:"tags"`
	TestToken              string     `json:"test_token"`
}

// SNMPTestError signals a user-facing SNMP test failure.
type SNMPTestError struct {
	Code    string
	Message string
	Err     error
}

func (e *SNMPTestError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

func (e *SNMPTestError) Unwrap() error {
	return e.Err
}

// TestSNMP validates credentials and produces a short-lived test token.
func (s *Service) TestSNMP(ctx context.Context, tenantID string, req TestSNMPRequest) (*TestSNMPResult, string, error) {
	if tenantID == "" {
		return nil, "", errors.New("tenant id missing")
	}
	req.IP = normalizeAddress(req.IP)
	if err := validateTestRequest(req); err != nil {
		return nil, "", err
	}
	normalized, err := normalizeSNMP(req.SNMP)
	if err != nil {
		return nil, "", err
	}

	v3 := snmpclient.V3Config{}
	if normalized.V3 != nil {
		v3 = snmpclient.V3Config{
			Username:     normalized.V3.Username,
			AuthProtocol: normalized.V3.AuthProtocol,
			AuthPassword: normalized.V3.AuthPassword,
			PrivProtocol: normalized.V3.PrivProtocol,
			PrivPassword: normalized.V3.PrivPassword,
		}
	}
	result, err := snmpclient.TestConnection(ctx, snmpclient.TestConfig{
		Address:   req.IP,
		Version:   normalized.Version,
		Community: normalized.Community,
		V3:        v3,
	})
	if err != nil {
		code, msg := mapSNMPError(err)
		return nil, "", &SNMPTestError{Code: code, Message: msg, Err: err}
	}

	testToken, err := GenerateTestToken()
	if err != nil {
		return nil, "", err
	}
	fingerprint := FingerprintSNMPConfig(req.IP, normalized)
	record := &store.DeviceTest{
		TenantID:            tenantID,
		IP:                  req.IP,
		SNMPFingerprintHash: fingerprint,
		TestToken:           testToken,
		ExpiresAt:           time.Now().UTC().Add(s.testTTL),
	}
	if err := s.store.CreateDeviceTest(ctx, record); err != nil {
		return nil, "", err
	}

	return &TestSNMPResult{
		SysName:          result.SysName,
		InterfacesCount:  result.InterfacesCount,
		UptimeSeconds:    int64(result.UptimeSeconds),
		SupportsMacTable: result.SupportsMacTable,
		Notes:            result.Notes,
	}, testToken, nil
}

// CreateDevice persists a registered device after a successful SNMP test.
func (s *Service) CreateDevice(ctx context.Context, tenantID string, req CreateDeviceRequest) (*store.Device, error) {
	if tenantID == "" {
		return nil, errors.New("tenant id missing")
	}
	req.IPOrHostname = normalizeAddress(req.IPOrHostname)
	if err := validateCreateRequest(req); err != nil {
		return nil, err
	}
	if s.encryptor == nil {
		return nil, errors.New("encryption key missing")
	}

	normalized, err := normalizeSNMP(req.SNMP)
	if err != nil {
		return nil, err
	}
	if existingID, ok, err := s.store.GetDeviceIDByIP(ctx, tenantID, req.IPOrHostname); err != nil {
		return nil, err
	} else if ok {
		return nil, &DeviceExistsError{DeviceID: existingID, IP: req.IPOrHostname}
	}
	fingerprint := FingerprintSNMPConfig(req.IPOrHostname, normalized)
	_, err = s.store.ConsumeDeviceTest(ctx, tenantID, req.IPOrHostname, fingerprint, req.TestToken)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("snmp test token invalid or expired")
		}
		return nil, err
	}

	payload, err := json.Marshal(normalized)
	if err != nil {
		return nil, err
	}
	encrypted, err := s.encryptor.Encrypt(payload)
	if err != nil {
		return nil, err
	}

	pollingInterval := req.PollingIntervalSeconds
	if pollingInterval <= 0 {
		pollingInterval = defaultPollingIntervalSeconds
	}
	tags := normalizeTags(req.Tags)

	now := time.Now().UTC()
	device := &store.Device{
		TenantID:               tenantID,
		Hostname:               strings.TrimSpace(req.DeviceName),
		MgmtIP:                 strings.TrimSpace(req.IPOrHostname),
		Community:              "",
		Enabled:                true,
		Site:                   "",
		Description:            "",
		DeviceType:             strings.ToLower(strings.TrimSpace(req.DeviceType)),
		SNMPVersion:            normalized.Version,
		SNMPConfigEncrypted:    encrypted,
		PollingIntervalSeconds: pollingInterval,
		Tags:                   tags,
		Status:                 "pending",
		LastTestedAt:           &now,
	}

	device, err = s.store.CreateDevice(ctx, device)
	if err != nil {
		if existingID, ok, lookupErr := s.store.GetDeviceIDByIP(ctx, tenantID, req.IPOrHostname); lookupErr == nil && ok {
			return nil, &DeviceExistsError{DeviceID: existingID, IP: req.IPOrHostname}
		}
		return nil, err
	}

	return device, nil
}

func validateTestRequest(req TestSNMPRequest) error {
	if strings.TrimSpace(req.IP) == "" {
		return errors.New("ip is required")
	}
	_, err := normalizeSNMP(req.SNMP)
	return err
}

func validateCreateRequest(req CreateDeviceRequest) error {
	if strings.TrimSpace(req.DeviceName) == "" {
		return errors.New("device_name is required")
	}
	if strings.TrimSpace(req.IPOrHostname) == "" {
		return errors.New("ip_or_hostname is required")
	}
	deviceType := strings.ToLower(strings.TrimSpace(req.DeviceType))
	if deviceType == "" {
		return errors.New("device_type is required")
	}
	switch deviceType {
	case "switch", "router", "firewall", "wlc", "other":
	default:
		return errors.New("device_type must be switch, router, firewall, wlc, or other")
	}
	if strings.TrimSpace(req.TestToken) == "" {
		return errors.New("test_token is required")
	}
	_, err := normalizeSNMP(req.SNMP)
	return err
}

func normalizeSNMP(snmp SNMPConfig) (SNMPConfig, error) {
	version := strings.TrimSpace(strings.ToLower(snmp.Version))
	switch version {
	case "2c", "3":
	default:
		return SNMPConfig{}, errors.New("snmp version must be 2c or 3")
	}

	if version == "2c" {
		if strings.TrimSpace(snmp.Community) == "" {
			return SNMPConfig{}, errors.New("snmp community is required")
		}
		return SNMPConfig{
			Version:   version,
			Community: snmp.Community,
		}, nil
	}

	if snmp.V3 == nil {
		return SNMPConfig{}, errors.New("snmp v3 config is required")
	}
	v3 := *snmp.V3
	v3.Username = strings.TrimSpace(v3.Username)
	v3.AuthProtocol = strings.ToUpper(strings.TrimSpace(v3.AuthProtocol))
	v3.AuthPassword = strings.TrimSpace(v3.AuthPassword)
	v3.PrivProtocol = strings.ToUpper(strings.TrimSpace(v3.PrivProtocol))
	v3.PrivPassword = strings.TrimSpace(v3.PrivPassword)

	if v3.Username == "" || v3.AuthProtocol == "" || v3.AuthPassword == "" || v3.PrivProtocol == "" || v3.PrivPassword == "" {
		return SNMPConfig{}, errors.New("snmp v3 fields are required")
	}
	if v3.AuthProtocol != "SHA" && v3.AuthProtocol != "MD5" {
		return SNMPConfig{}, errors.New("snmp v3 auth_protocol must be SHA or MD5")
	}
	if v3.PrivProtocol != "AES" && v3.PrivProtocol != "DES" {
		return SNMPConfig{}, errors.New("snmp v3 priv_protocol must be AES or DES")
	}

	return SNMPConfig{
		Version: version,
		V3:      &v3,
	}, nil
}

func normalizeTags(tags []string) []string {
	out := make([]string, 0, len(tags))
	seen := map[string]struct{}{}
	for _, tag := range tags {
		trimmed := strings.TrimSpace(tag)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, trimmed)
	}
	return out
}
