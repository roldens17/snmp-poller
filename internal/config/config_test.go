package config

import (
	"testing"
	"time"

	"gopkg.in/yaml.v3"
)

// --- applyDefaults ---

func TestApplyDefaults_NumericFields(t *testing.T) {
	var c Config
	c.applyDefaults()

	cases := []struct {
		name string
		got  any
		want any
	}{
		{"WorkerCount", c.WorkerCount, 4},
		{"Postgres.MaxConns", int(c.Postgres.MaxConns), 8},
		{"SNMP.Port", int(c.SNMP.Port), 161},
		{"SNMP.Retries", c.SNMP.Retries, 1},
		{"Discovery.WorkerCount", c.Discovery.WorkerCount, 16},
		{"Auth.LoginRatePerMinute", c.Auth.LoginRatePerMinute, 20},
		{"Auth.LoginBurst", c.Auth.LoginBurst, 10},
	}
	for _, tc := range cases {
		if tc.got != tc.want {
			t.Errorf("%s: got %v, want %v", tc.name, tc.got, tc.want)
		}
	}
}

func TestApplyDefaults_StringFields(t *testing.T) {
	var c Config
	c.applyDefaults()

	cases := []struct{ name, got, want string }{
		{"HTTP.Addr", c.HTTP.Addr, ":8080"},
		{"Metrics.Addr", c.Metrics.Addr, ":9105"},
		{"Auth.CookieName", c.Auth.CookieName, "snmpai_session"},
		{"Auth.CookieSameSite", c.Auth.CookieSameSite, "lax"},
		{"SNMP.Version", c.SNMP.Version, "2c"},
		{"DefaultTenantSlug", c.DefaultTenantSlug, "default"},
	}
	for _, tc := range cases {
		if tc.got != tc.want {
			t.Errorf("%s: got %q, want %q", tc.name, tc.got, tc.want)
		}
	}
}

func TestApplyDefaults_Durations(t *testing.T) {
	var c Config
	c.applyDefaults()

	cases := []struct {
		name string
		got  time.Duration
		want time.Duration
	}{
		{"PollInterval", c.PollInterval.Duration, time.Minute},
		{"SNMP.Timeout", c.SNMP.Timeout.Duration, 5 * time.Second},
		{"Discovery.Timeout", c.Discovery.Timeout.Duration, 2 * time.Second},
		{"Discovery.Interval", c.Discovery.Interval.Duration, 15 * time.Minute},
		{"Alerting.InterfaceDownAfter", c.Alerting.InterfaceDownAfter.Duration, 2 * time.Minute},
		{"Auth.TokenTTL", c.Auth.TokenTTL.Duration, 24 * time.Hour},
	}
	for _, tc := range cases {
		if tc.got != tc.want {
			t.Errorf("%s: got %v, want %v", tc.name, tc.got, tc.want)
		}
	}
}

func TestApplyDefaults_AlertThresholds(t *testing.T) {
	var c Config
	c.applyDefaults()

	if c.Alerting.ErrorRateThreshold != 0.05 {
		t.Errorf("ErrorRateThreshold: got %v, want 0.05", c.Alerting.ErrorRateThreshold)
	}
	if c.Alerting.BandwidthThreshold != 0.80 {
		t.Errorf("BandwidthThreshold: got %v, want 0.80", c.Alerting.BandwidthThreshold)
	}
}

func TestApplyDefaults_CookieHTTPOnlyDefaultsTrue(t *testing.T) {
	var c Config
	c.applyDefaults()
	if c.Auth.CookieHTTPOnly == nil || !*c.Auth.CookieHTTPOnly {
		t.Error("CookieHTTPOnly should default to true")
	}
}

func TestApplyDefaults_DoesNotOverwriteExplicitValues(t *testing.T) {
	c := Config{WorkerCount: 8}
	c.applyDefaults()
	if c.WorkerCount != 8 {
		t.Errorf("WorkerCount should not be overwritten; got %d", c.WorkerCount)
	}
}

func TestApplyDefaults_SwitchInheritsSnmpDefaults(t *testing.T) {
	c := Config{
		SNMP:     SNMPDefaults{Community: "public", Port: 161, Version: "2c", Retries: 1, Timeout: Duration{5 * time.Second}},
		Switches: []Switch{{Name: "sw1", Address: "10.0.0.1"}},
	}
	c.applyDefaults()

	sw := c.Switches[0]
	if sw.Community != "public" {
		t.Errorf("switch community: got %q, want %q", sw.Community, "public")
	}
	if sw.Port != 161 {
		t.Errorf("switch port: got %d, want 161", sw.Port)
	}
	if sw.Version != "2c" {
		t.Errorf("switch version: got %q, want %q", sw.Version, "2c")
	}
	if sw.Enabled == nil || !*sw.Enabled {
		t.Error("switch enabled should default to true")
	}
}

// --- applyEnvOverrides ---

func TestEnvOverride_PollInterval(t *testing.T) {
	t.Setenv("POLL_INTERVAL", "30s")
	var c Config
	c.applyEnvOverrides()
	if c.PollInterval.Duration != 30*time.Second {
		t.Errorf("got %v, want 30s", c.PollInterval.Duration)
	}
}

func TestEnvOverride_WorkerCount(t *testing.T) {
	t.Setenv("WORKER_COUNT", "12")
	var c Config
	c.applyEnvOverrides()
	if c.WorkerCount != 12 {
		t.Errorf("got %d, want 12", c.WorkerCount)
	}
}

func TestEnvOverride_WorkerCountInvalidIgnored(t *testing.T) {
	t.Setenv("WORKER_COUNT", "not-a-number")
	c := Config{WorkerCount: 4}
	c.applyEnvOverrides()
	if c.WorkerCount != 4 {
		t.Errorf("invalid WORKER_COUNT should be ignored; got %d", c.WorkerCount)
	}
}

func TestEnvOverride_PostgresDSN(t *testing.T) {
	t.Setenv("POSTGRES_DSN", "postgres://user:pass@localhost/db")
	var c Config
	c.applyEnvOverrides()
	if c.Postgres.DSN != "postgres://user:pass@localhost/db" {
		t.Errorf("got %q", c.Postgres.DSN)
	}
}

func TestEnvOverride_PostgresMaxConns(t *testing.T) {
	t.Setenv("POSTGRES_MAX_CONNS", "20")
	var c Config
	c.applyEnvOverrides()
	if c.Postgres.MaxConns != 20 {
		t.Errorf("got %d, want 20", c.Postgres.MaxConns)
	}
}

func TestEnvOverride_AuthJWTSecret(t *testing.T) {
	t.Setenv("AUTH_JWT_SECRET", "super-secret")
	var c Config
	c.applyEnvOverrides()
	if c.Auth.JWTSecret != "super-secret" {
		t.Errorf("got %q", c.Auth.JWTSecret)
	}
}

func TestEnvOverride_AuthCookieName(t *testing.T) {
	t.Setenv("AUTH_COOKIE_NAME", "my_session")
	var c Config
	c.applyEnvOverrides()
	if c.Auth.CookieName != "my_session" {
		t.Errorf("got %q", c.Auth.CookieName)
	}
}

func TestEnvOverride_AuthCookieSecureTrue(t *testing.T) {
	for _, val := range []string{"true", "1"} {
		t.Setenv("AUTH_COOKIE_SECURE", val)
		var c Config
		c.applyEnvOverrides()
		if c.Auth.CookieSecure == nil || !*c.Auth.CookieSecure {
			t.Errorf("AUTH_COOKIE_SECURE=%q should set CookieSecure=true", val)
		}
	}
}

func TestEnvOverride_AuthCookieSecureFalse(t *testing.T) {
	t.Setenv("AUTH_COOKIE_SECURE", "false")
	var c Config
	c.applyEnvOverrides()
	if c.Auth.CookieSecure == nil || *c.Auth.CookieSecure {
		t.Error("AUTH_COOKIE_SECURE=false should set CookieSecure=false")
	}
}

func TestEnvOverride_AuthTokenTTLHours(t *testing.T) {
	t.Setenv("AUTH_TOKEN_TTL_HOURS", "48")
	var c Config
	c.applyEnvOverrides()
	if c.Auth.TokenTTL.Duration != 48*time.Hour {
		t.Errorf("got %v, want 48h", c.Auth.TokenTTL.Duration)
	}
}

func TestEnvOverride_AuthAllowRegister(t *testing.T) {
	for _, val := range []string{"true", "1"} {
		t.Setenv("AUTH_ALLOW_REGISTER", val)
		var c Config
		c.applyEnvOverrides()
		if !c.Auth.AllowRegister {
			t.Errorf("AUTH_ALLOW_REGISTER=%q should enable registration", val)
		}
	}
}

func TestEnvOverride_DiscoveryEnabled(t *testing.T) {
	t.Setenv("DISCOVERY_ENABLED", "1")
	var c Config
	c.applyEnvOverrides()
	if !c.Discovery.Enabled {
		t.Error("DISCOVERY_ENABLED=1 should enable discovery")
	}
}

func TestEnvOverride_MetricsEnabled(t *testing.T) {
	t.Setenv("METRICS_ENABLED", "true")
	var c Config
	c.applyEnvOverrides()
	if !c.Metrics.Enabled {
		t.Error("METRICS_ENABLED=true should enable metrics")
	}
}

func TestEnvOverride_AlertErrorRate(t *testing.T) {
	t.Setenv("ALERT_ERROR_RATE", "0.10")
	var c Config
	c.applyEnvOverrides()
	if c.Alerting.ErrorRateThreshold != 0.10 {
		t.Errorf("got %v, want 0.10", c.Alerting.ErrorRateThreshold)
	}
}

func TestEnvOverride_AlertBandwidth(t *testing.T) {
	t.Setenv("ALERT_BANDWIDTH", "0.95")
	var c Config
	c.applyEnvOverrides()
	if c.Alerting.BandwidthThreshold != 0.95 {
		t.Errorf("got %v, want 0.95", c.Alerting.BandwidthThreshold)
	}
}

func TestEnvOverride_CORSAllowedOrigins(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com, https://admin.example.com")
	var c Config
	c.applyEnvOverrides()
	if len(c.HTTP.AllowedOrigins) != 2 {
		t.Fatalf("got %d origins, want 2: %v", len(c.HTTP.AllowedOrigins), c.HTTP.AllowedOrigins)
	}
	if c.HTTP.AllowedOrigins[0] != "https://app.example.com" {
		t.Errorf("first origin: got %q", c.HTTP.AllowedOrigins[0])
	}
}

func TestEnvOverride_DemoMode(t *testing.T) {
	t.Setenv("DEMO_MODE", "1")
	var c Config
	c.applyEnvOverrides()
	if !c.DemoMode {
		t.Error("DEMO_MODE=1 should enable demo mode")
	}
}

func TestEnvOverride_DashboardBaseURL(t *testing.T) {
	t.Setenv("DASHBOARD_BASE_URL", "https://dashboard.example.com")
	var c Config
	c.applyEnvOverrides()
	if c.HTTP.DashboardBaseURL != "https://dashboard.example.com" {
		t.Errorf("got %q", c.HTTP.DashboardBaseURL)
	}
}

// --- Validate ---

func TestValidate_MissingPostgresDSN(t *testing.T) {
	t.Setenv("ALLOW_EMPTY_SWITCHES", "1")
	c := Config{}
	c.applyDefaults()
	c.Auth.JWTSecret = "long-enough-secret-for-test-here"
	if err := c.Validate(); err == nil || err.Error() != "postgres.dsn is required (set POSTGRES_DSN or configure postgres.dsn)" {
		t.Errorf("expected postgres DSN error, got %v", err)
	}
}

func TestValidate_MissingJWTSecret(t *testing.T) {
	t.Setenv("ALLOW_EMPTY_SWITCHES", "1")
	c := Config{}
	c.applyDefaults()
	c.Postgres.DSN = "postgres://localhost/db"
	if err := c.Validate(); err == nil || err.Error() != "auth.jwt_secret is required (set AUTH_JWT_SECRET or configure auth.jwt_secret)" {
		t.Errorf("expected JWT secret error, got %v", err)
	}
}

func TestValidate_NoSwitchesNoDiscovery(t *testing.T) {
	c := Config{}
	c.applyDefaults()
	c.Postgres.DSN = "postgres://localhost/db"
	c.Auth.JWTSecret = "long-enough-secret-for-test-here"
	if err := c.Validate(); err == nil {
		t.Error("expected error when no switches and discovery disabled")
	}
}

func TestValidate_AllowEmptySwitches(t *testing.T) {
	t.Setenv("ALLOW_EMPTY_SWITCHES", "1")
	c := Config{}
	c.applyDefaults()
	c.Postgres.DSN = "postgres://localhost/db"
	c.Auth.JWTSecret = "long-enough-secret-for-test-here"
	if err := c.Validate(); err != nil {
		t.Errorf("unexpected error with ALLOW_EMPTY_SWITCHES=1: %v", err)
	}
}

func TestValidate_DiscoveryBypassesSwitchRequirement(t *testing.T) {
	c := Config{}
	c.applyDefaults()
	c.Postgres.DSN = "postgres://localhost/db"
	c.Auth.JWTSecret = "long-enough-secret-for-test-here"
	c.Discovery.Enabled = true
	if err := c.Validate(); err != nil {
		t.Errorf("unexpected error when discovery enabled: %v", err)
	}
}

// --- AuthConfig helpers ---

func TestCookieSecureValue_NilDefaultsFalse(t *testing.T) {
	a := AuthConfig{}
	if a.CookieSecureValue() {
		t.Error("nil CookieSecure should default to false")
	}
}

func TestCookieHTTPOnlyValue_NilDefaultsTrue(t *testing.T) {
	a := AuthConfig{}
	if !a.CookieHTTPOnlyValue() {
		t.Error("nil CookieHTTPOnly should default to true")
	}
}

func TestCookieSameSiteValue_EmptyDefaultsLax(t *testing.T) {
	a := AuthConfig{}
	if a.CookieSameSiteValue() != "lax" {
		t.Errorf("empty CookieSameSite should default to 'lax', got %q", a.CookieSameSiteValue())
	}
}

func TestCookieSameSiteValue_NormalizesToLower(t *testing.T) {
	a := AuthConfig{CookieSameSite: "STRICT"}
	if a.CookieSameSiteValue() != "strict" {
		t.Errorf("got %q, want 'strict'", a.CookieSameSiteValue())
	}
}

// --- Switch.EnabledValue ---

func TestSwitchEnabledValue(t *testing.T) {
	trueVal, falseVal := true, false
	cases := []struct {
		enabled *bool
		want    bool
	}{
		{nil, true},
		{&trueVal, true},
		{&falseVal, false},
	}
	for _, tc := range cases {
		sw := Switch{Enabled: tc.enabled}
		if sw.EnabledValue() != tc.want {
			t.Errorf("EnabledValue() with %v: got %v, want %v", tc.enabled, sw.EnabledValue(), tc.want)
		}
	}
}

// --- Duration.UnmarshalYAML ---

func unmarshalDuration(t *testing.T, yamlStr string) Duration {
	t.Helper()
	type wrapper struct {
		D Duration `yaml:"d"`
	}
	var w wrapper
	if err := yaml.Unmarshal([]byte(yamlStr), &w); err != nil {
		t.Fatalf("yaml unmarshal failed: %v", err)
	}
	return w.D
}

func TestDurationUnmarshalYAML_StringSeconds(t *testing.T) {
	d := unmarshalDuration(t, "d: 30s")
	if d.Duration != 30*time.Second {
		t.Errorf("got %v, want 30s", d.Duration)
	}
}

func TestDurationUnmarshalYAML_StringMinutes(t *testing.T) {
	d := unmarshalDuration(t, "d: 1m30s")
	if d.Duration != 90*time.Second {
		t.Errorf("got %v, want 1m30s", d.Duration)
	}
}

func TestDurationUnmarshalYAML_IntegerNanoseconds(t *testing.T) {
	d := unmarshalDuration(t, "d: 5000000000") // 5s in nanoseconds
	if d.Duration != 5*time.Second {
		t.Errorf("got %v, want 5s", d.Duration)
	}
}

func TestDurationUnmarshalYAML_InvalidStringReturnsError(t *testing.T) {
	type wrapper struct {
		D Duration `yaml:"d"`
	}
	var w wrapper
	err := yaml.Unmarshal([]byte("d: not-a-duration"), &w)
	if err == nil {
		t.Error("expected error for invalid duration string")
	}
}
