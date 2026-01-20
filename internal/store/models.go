package store

import "time"

// Tenant represents a tenant organization.
type Tenant struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UserTenant represents the many-to-many relationship.
type UserTenant struct {
	UserID    string    `json:"user_id"`
	TenantID  string    `json:"tenant_id"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

// User represents an authenticated user account.
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Device represents a managed switch.
type Device struct {
	ID          int64     `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Hostname    string    `json:"hostname"`
	MgmtIP      string    `json:"mgmt_ip"`
	Community   string    `json:"snmp_community"`
	Enabled     bool      `json:"enabled"`
	Site        string    `json:"site"`
	Description string    `json:"description"`
	LastSeen    time.Time `json:"last_seen"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// InterfaceState captures the latest administrative and traffic state.
type InterfaceState struct {
	DeviceID        int64     `json:"device_id"`
	IfIndex         int       `json:"if_index"`
	IfName          string    `json:"if_name"`
	IfDescr         string    `json:"if_descr"`
	AdminStatus     string    `json:"admin_status"`
	OperStatus      string    `json:"oper_status"`
	Speed           uint64    `json:"speed_bps"`
	InOctets        uint64    `json:"in_octets"`
	OutOctets       uint64    `json:"out_octets"`
	InErrors        uint64    `json:"in_errors"`
	OutErrors       uint64    `json:"out_errors"`
	StatusChangedAt time.Time `json:"status_changed_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// InterfaceCounters stores the historical counters for a sample time.
type InterfaceCounters struct {
	DeviceID    int64     `json:"device_id"`
	IfIndex     int       `json:"if_index"`
	InOctets    uint64    `json:"in_octets"`
	OutOctets   uint64    `json:"out_octets"`
	InErrors    uint64    `json:"in_errors"`
	OutErrors   uint64    `json:"out_errors"`
	CollectedAt time.Time `json:"collected_at"`
}

// MACEntry is a bridge forwarding database record.
type MACEntry struct {
	DeviceID  int64     `json:"device_id"`
	TenantID  string    `json:"tenant_id"` // Denormalized for query convenience
	VLAN      *int      `json:"vlan"`
	MAC       string    `json:"mac"`
	IfIndex   *int      `json:"if_index"`
	FirstSeen time.Time `json:"first_seen"`
	LastSeen  time.Time `json:"last_seen"`
}

// Alert records alerting events.
type Alert struct {
	ID          int64      `json:"id"`
	TenantID    string     `json:"tenant_id"`
	DeviceID    int64      `json:"device_id"`
	IfIndex     *int       `json:"if_index"`
	Category    string     `json:"category"`
	Severity    string     `json:"severity"`
	Message     string     `json:"message"`
	Metadata    any        `json:"metadata"`
	TriggeredAt time.Time  `json:"triggered_at"`
	ResolvedAt  *time.Time `json:"resolved_at"`
}

// DiscoveryRecord stores probing results for future onboarding.
type DiscoveryRecord struct {
	ID          int64     `json:"id"`
	TenantID    string    `json:"tenant_id"`
	IP          string    `json:"ip"`
	Hostname    string    `json:"hostname"`
	Community   string    `json:"community"`
	Reachable   bool      `json:"reachable"`
	LastAttempt time.Time `json:"last_attempt"`
}

// AlertDestination defines where notifications are sent.
type AlertDestination struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	Type      string    `json:"type"` // e.g. "webhook"
	Name      string    `json:"name"` // e.g. "Slack NOC"
	URL       string    `json:"url"`  // Redacted in API responses
	IsEnabled bool      `json:"is_enabled"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
