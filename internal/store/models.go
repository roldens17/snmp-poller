package store

import "time"

// Organization represents a tenant.
type Organization struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Device represents a managed switch.
type Device struct {
	ID          int64     `json:"id"`
	OrgID       int64     `json:"org_id"`
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
	VLAN      *int      `json:"vlan"`
	MAC       string    `json:"mac"`
	IfIndex   *int      `json:"if_index"`
	FirstSeen time.Time `json:"first_seen"`
	LastSeen  time.Time `json:"last_seen"`
}

// Alert records alerting events.
type Alert struct {
	ID          int64      `json:"id"`
	OrgID       int64      `json:"org_id"`
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
	OrgID       int64     `json:"org_id"`
	IP          string    `json:"ip"`
	Hostname    string    `json:"hostname"`
	Community   string    `json:"community"`
	Reachable   bool      `json:"reachable"`
	LastAttempt time.Time `json:"last_attempt"`
}
