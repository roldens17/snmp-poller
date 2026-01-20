package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// Duration is a helper type to decode Go duration strings from YAML/env.
type Duration struct {
	time.Duration
}

// UnmarshalYAML parses values such as "5s" or "1m30s" into a duration.
func (d *Duration) UnmarshalYAML(value *yaml.Node) error {
	var raw string
	if err := value.Decode(&raw); err == nil {
		dur, err := time.ParseDuration(raw)
		if err != nil {
			return err
		}
		d.Duration = dur
		return nil
	}

	var asInt int64
	if err := value.Decode(&asInt); err == nil {
		d.Duration = time.Duration(asInt)
		return nil
	}

	return fmt.Errorf("could not parse duration from %q", value.Value)
}

// Config holds service configuration loaded from YAML and env.
type Config struct {
	PollInterval Duration       `yaml:"poll_interval"`
	WorkerCount  int            `yaml:"worker_count"`
	Switches     []Switch       `yaml:"switches"`
	Postgres     PostgresConfig `yaml:"postgres"`
	HTTP         HTTPConfig     `yaml:"http"`
	Auth         AuthConfig     `yaml:"auth"`
	SNMP         SNMPDefaults   `yaml:"snmp_defaults"`
	Discovery    Discovery      `yaml:"discovery"`
	Alerting     Alerting       `yaml:"alerts"`
	Metrics      Metrics        `yaml:"metrics"`
}

// Switch describes an SNMP-enabled switch target.
type Switch struct {
	Name        string   `yaml:"name"`
	Address     string   `yaml:"address"`
	Community   string   `yaml:"community"`
	Version     string   `yaml:"version"`
	Port        uint16   `yaml:"port"`
	Timeout     Duration `yaml:"timeout"`
	Retries     int      `yaml:"retries"`
	Enabled     *bool    `yaml:"enabled"`
	Site        string   `yaml:"site"`
	Description string   `yaml:"description"`
}

// EnabledValue returns true when switch should be polled.
func (s Switch) EnabledValue() bool {
	if s.Enabled == nil {
		return true
	}
	return *s.Enabled
}

// PostgresConfig carries connection information.
type PostgresConfig struct {
	DSN      string `yaml:"dsn"`
	MaxConns int32  `yaml:"max_conns"`
}

// HTTPConfig configures the REST server.
type HTTPConfig struct {
	Addr           string   `yaml:"addr"`
	EnableTLS      bool     `yaml:"enable_tls"`
	CertFile       string   `yaml:"cert_file"`
	KeyFile        string   `yaml:"key_file"`
	EnableDebug    bool     `yaml:"debug"`
	AllowedOrigins []string `yaml:"allowed_origins"`
}

// AuthConfig defines authentication settings.
type AuthConfig struct {
	JWTSecret     string   `yaml:"jwt_secret"`
	CookieName    string   `yaml:"cookie_name"`
	CookieSecure  *bool    `yaml:"cookie_secure"`
	TokenTTL      Duration `yaml:"token_ttl"`
	AllowRegister bool     `yaml:"allow_register"`
}

// CookieSecureValue returns the secure cookie setting, defaulting to false.
func (a AuthConfig) CookieSecureValue() bool {
	if a.CookieSecure == nil {
		return false
	}
	return *a.CookieSecure
}

// SNMPDefaults captures default switch polling parameters.
type SNMPDefaults struct {
	Community string   `yaml:"community"`
	Version   string   `yaml:"version"`
	Port      uint16   `yaml:"port"`
	Timeout   Duration `yaml:"timeout"`
	Retries   int      `yaml:"retries"`
}

// Discovery configures optional subnet sweep for SNMP-capable hosts.
type Discovery struct {
	Enabled     bool     `yaml:"enabled"`
	Subnets     []string `yaml:"subnets"`
	WorkerCount int      `yaml:"worker_count"`
	Timeout     Duration `yaml:"timeout"`
	Interval    Duration `yaml:"interval"`
}

// Alerting controls alert thresholds.
type Alerting struct {
	InterfaceDownAfter Duration `yaml:"interface_down_after"`
	ErrorRateThreshold float64  `yaml:"error_rate_threshold"`
	BandwidthThreshold float64  `yaml:"bandwidth_threshold"`
}

// Metrics exposes Prometheus endpoint.
type Metrics struct {
	Enabled bool   `yaml:"enabled"`
	Addr    string `yaml:"addr"`
}

// Load reads the YAML file (if present) and returns Config. Empty path skips file read.
func Load(path string) (*Config, error) {
	var cfg Config

	if path != "" {
		b, err := os.ReadFile(path)
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return nil, err
		}
		if err == nil {
			if err := yaml.Unmarshal(b, &cfg); err != nil {
				return nil, err
			}
		}
	}

	cfg.applyDefaults()
	cfg.applyEnvOverrides()
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return &cfg, nil
}

// Validate inspects config values for missing data.
func (c *Config) Validate() error {
	active := 0
	for _, sw := range c.Switches {
		if sw.EnabledValue() {
			active++
		}
		if sw.EnabledValue() && (sw.Name == "" || sw.Address == "") {
			return fmt.Errorf("switch %q must include name and address", sw.Name)
		}
	}

	if active == 0 && !c.Discovery.Enabled {
		return errors.New("define at least one enabled switch or turn on discovery")
	}

	if c.Postgres.DSN == "" {
		return errors.New("postgres.dsn is required (set POSTGRES_DSN or configure postgres.dsn)")
	}
	if c.Auth.JWTSecret == "" {
		return errors.New("auth.jwt_secret is required (set AUTH_JWT_SECRET or configure auth.jwt_secret)")
	}

	return nil
}

func (c *Config) applyDefaults() {
	if c.PollInterval.Duration == 0 {
		c.PollInterval.Duration = time.Minute
	}
	if c.WorkerCount == 0 {
		c.WorkerCount = 4
	}
	if c.HTTP.Addr == "" {
		c.HTTP.Addr = ":8080"
	}
	if len(c.HTTP.AllowedOrigins) == 0 {
		c.HTTP.AllowedOrigins = []string{"http://localhost:3000"}
	}
	if c.Postgres.MaxConns == 0 {
		c.Postgres.MaxConns = 8
	}
	if c.Auth.CookieName == "" {
		c.Auth.CookieName = "snmpai_session"
	}
	if c.Auth.TokenTTL.Duration == 0 {
		c.Auth.TokenTTL.Duration = 24 * time.Hour
	}
	if c.Auth.CookieSecure == nil {
		secure := strings.EqualFold(os.Getenv("ENV"), "production")
		c.Auth.CookieSecure = &secure
	}

	if c.SNMP.Port == 0 {
		c.SNMP.Port = 161
	}
	if c.SNMP.Timeout.Duration == 0 {
		c.SNMP.Timeout.Duration = 5 * time.Second
	}
	if c.SNMP.Retries == 0 {
		c.SNMP.Retries = 1
	}
	if c.SNMP.Version == "" {
		c.SNMP.Version = "2c"
	}

	if c.Discovery.WorkerCount == 0 {
		c.Discovery.WorkerCount = 16
	}
	if c.Discovery.Timeout.Duration == 0 {
		c.Discovery.Timeout.Duration = 2 * time.Second
	}
	if c.Discovery.Interval.Duration == 0 {
		c.Discovery.Interval.Duration = 15 * time.Minute
	}

	if c.Alerting.InterfaceDownAfter.Duration == 0 {
		c.Alerting.InterfaceDownAfter.Duration = 2 * time.Minute
	}
	if c.Alerting.ErrorRateThreshold == 0 {
		c.Alerting.ErrorRateThreshold = 0.05
	}
	if c.Alerting.BandwidthThreshold == 0 {
		c.Alerting.BandwidthThreshold = 0.80
	}
	if c.Metrics.Addr == "" {
		c.Metrics.Addr = ":9105"
	}

	for i := range c.Switches {
		sw := &c.Switches[i]
		if sw.Enabled == nil {
			defaultEnabled := true
			sw.Enabled = &defaultEnabled
		}
		if sw.Port == 0 {
			sw.Port = c.SNMP.Port
		}
		if sw.Timeout.Duration == 0 {
			sw.Timeout.Duration = c.SNMP.Timeout.Duration
		}
		if sw.Retries == 0 {
			sw.Retries = c.SNMP.Retries
		}
		if sw.Version == "" {
			sw.Version = c.SNMP.Version
		}
		if sw.Community == "" {
			sw.Community = c.SNMP.Community
		}
	}
}

// applyEnvOverrides allows env vars to tweak config without editing YAML.
func (c *Config) applyEnvOverrides() {
	if v := os.Getenv("POLL_INTERVAL"); v != "" {
		if dur, err := time.ParseDuration(v); err == nil {
			c.PollInterval.Duration = dur
		}
	}
	if v := os.Getenv("WORKER_COUNT"); v != "" {
		if i, err := strconv.Atoi(v); err == nil && i > 0 {
			c.WorkerCount = i
		}
	}
	if v := os.Getenv("HTTP_ADDR"); v != "" {
		c.HTTP.Addr = v
	}
	if v := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS")); v != "" {
		origins := strings.Split(v, ",")
		c.HTTP.AllowedOrigins = make([]string, 0, len(origins))
		for _, origin := range origins {
			trimmed := strings.TrimSpace(origin)
			if trimmed != "" {
				c.HTTP.AllowedOrigins = append(c.HTTP.AllowedOrigins, trimmed)
			}
		}
	}
	if v := strings.TrimSpace(os.Getenv("POSTGRES_DSN")); v != "" {
		c.Postgres.DSN = v
	}
	if v := os.Getenv("POSTGRES_MAX_CONNS"); v != "" {
		if i, err := strconv.Atoi(v); err == nil && i > 0 {
			c.Postgres.MaxConns = int32(i)
		}
	}
	if v := os.Getenv("METRICS_ADDR"); v != "" {
		c.Metrics.Addr = v
	}
	if v := os.Getenv("METRICS_ENABLED"); v != "" {
		c.Metrics.Enabled = v == "1" || v == "true"
	}
	if v := os.Getenv("DISCOVERY_ENABLED"); v != "" {
		c.Discovery.Enabled = v == "1" || v == "true"
	}
	if v := os.Getenv("ALERT_ERROR_RATE"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			c.Alerting.ErrorRateThreshold = f
		}
	}
	if v := os.Getenv("ALERT_BANDWIDTH"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			c.Alerting.BandwidthThreshold = f
		}
	}
	if v := os.Getenv("DISCOVERY_INTERVAL"); v != "" {
		if dur, err := time.ParseDuration(v); err == nil {
			c.Discovery.Interval.Duration = dur
		}
	}
	if v := strings.TrimSpace(os.Getenv("AUTH_JWT_SECRET")); v != "" {
		c.Auth.JWTSecret = v
	}
	if v := strings.TrimSpace(os.Getenv("AUTH_COOKIE_NAME")); v != "" {
		c.Auth.CookieName = v
	}
	if v := strings.TrimSpace(os.Getenv("AUTH_COOKIE_SECURE")); v != "" {
		secure := v == "1" || strings.EqualFold(v, "true")
		c.Auth.CookieSecure = &secure
	}
	if v := strings.TrimSpace(os.Getenv("AUTH_TOKEN_TTL_HOURS")); v != "" {
		if hours, err := strconv.Atoi(v); err == nil && hours > 0 {
			c.Auth.TokenTTL.Duration = time.Duration(hours) * time.Hour
		}
	}
	if v := strings.TrimSpace(os.Getenv("AUTH_ALLOW_REGISTER")); v != "" {
		c.Auth.AllowRegister = v == "1" || strings.EqualFold(v, "true")
	}
}
