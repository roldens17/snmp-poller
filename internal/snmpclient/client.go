package snmpclient

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/gosnmp/gosnmp"

	"github.com/fresatu/snmp-poller/internal/config"
)

// InterfaceMetric carries SNMP sampled data.
type InterfaceMetric struct {
	Index     int
	Name      string
	Descr     string
	Admin     string
	Oper      string
	Speed     uint64
	InOctets  uint64
	OutOctets uint64
	InErrors  uint64
	OutErrors uint64
}

// MACRecord describes a single MAC forwarding entry.
type MACRecord struct {
	VLAN    *int
	MAC     string
	IfIndex int
}

// ProbeResult captures discovery SNMP reachability.
type ProbeResult struct {
	Reachable bool
	Hostname  string
}

var (
	ifDescrOID       = "1.3.6.1.2.1.2.2.1.2"
	ifNameOID        = "1.3.6.1.2.1.31.1.1.1.1"
	ifAliasOID       = "1.3.6.1.2.1.31.1.1.1.18"
	ifAdminStatusOID = "1.3.6.1.2.1.2.2.1.7"
	ifOperStatusOID  = "1.3.6.1.2.1.2.2.1.8"
	ifSpeedOID       = "1.3.6.1.2.1.2.2.1.5"
	ifHighSpeedOID   = "1.3.6.1.2.1.31.1.1.1.15"
	ifHCInOctetsOID  = "1.3.6.1.2.1.31.1.1.1.6"
	ifHCOutOctetsOID = "1.3.6.1.2.1.31.1.1.1.10"
	ifInErrorsOID    = "1.3.6.1.2.1.2.2.1.14"
	ifOutErrorsOID   = "1.3.6.1.2.1.2.2.1.20"

	dot1dBasePortIfIndexOID = "1.3.6.1.2.1.17.1.4.1.2"
	dot1dTpFdbPortOID       = "1.3.6.1.2.1.17.4.3.1.2"
	dot1qTpFdbPortOID       = "1.3.6.1.2.1.17.7.1.2.2.1.2"

	sysNameOID = "1.3.6.1.2.1.1.5.0"
)

var statusLookup = map[int]string{
	1: "up",
	2: "down",
	3: "testing",
	4: "unknown",
	5: "dormant",
	6: "notPresent",
	7: "lowerLayerDown",
}

// PollInterfaces collects interface state and counters for a target.
func PollInterfaces(ctx context.Context, target config.Switch) ([]InterfaceMetric, error) {
	session, err := newSession(target)
	if err != nil {
		return nil, err
	}
	if err := session.Connect(); err != nil {
		return nil, err
	}
	defer session.Conn.Close()

	descr, err := walkString(ctx, session, ifDescrOID)
	if err != nil {
		return nil, fmt.Errorf("ifDescr walk: %w", err)
	}
	name, _ := walkString(ctx, session, ifNameOID)
	alias, _ := walkString(ctx, session, ifAliasOID)
	admin, err := walkInt(ctx, session, ifAdminStatusOID)
	if err != nil {
		return nil, fmt.Errorf("ifAdmin walk: %w", err)
	}
	oper, err := walkInt(ctx, session, ifOperStatusOID)
	if err != nil {
		return nil, fmt.Errorf("ifOper walk: %w", err)
	}
	speed32, _ := walkUint64(ctx, session, ifSpeedOID)
	speedHigh, _ := walkUint64(ctx, session, ifHighSpeedOID)
	inOctets, _ := walkUint64(ctx, session, ifHCInOctetsOID)
	outOctets, _ := walkUint64(ctx, session, ifHCOutOctetsOID)
	inErrors, _ := walkUint64(ctx, session, ifInErrorsOID)
	outErrors, _ := walkUint64(ctx, session, ifOutErrorsOID)

	indexes := map[int]struct{}{}
	for idx := range descr {
		indexes[idx] = struct{}{}
	}
	for idx := range name {
		indexes[idx] = struct{}{}
	}
	for idx := range admin {
		indexes[idx] = struct{}{}
	}
	for idx := range oper {
		indexes[idx] = struct{}{}
	}
	for idx := range speed32 {
		indexes[idx] = struct{}{}
	}
	for idx := range speedHigh {
		indexes[idx] = struct{}{}
	}

	var metrics []InterfaceMetric
	for idx := range indexes {
		m := InterfaceMetric{Index: idx}
		m.Descr = descr[idx]
		if alias[idx] != "" {
			m.Descr = alias[idx]
		}
		if name[idx] != "" {
			m.Name = name[idx]
		} else {
			m.Name = descr[idx]
		}
		m.Admin = statusLookup[admin[idx]]
		m.Oper = statusLookup[oper[idx]]
		s := speed32[idx]
		if hs := speedHigh[idx]; hs > 0 {
			// convert reported Mbps to bps
			s = hs * 1_000_000
		}
		m.Speed = s
		m.InOctets = inOctets[idx]
		m.OutOctets = outOctets[idx]
		m.InErrors = inErrors[idx]
		m.OutErrors = outErrors[idx]
		metrics = append(metrics, m)
	}

	return metrics, nil
}

// PollMACTable returns bridge forwarding entries.
func PollMACTable(ctx context.Context, target config.Switch) ([]MACRecord, error) {
	session, err := newSession(target)
	if err != nil {
		return nil, err
	}
	if err := session.Connect(); err != nil {
		return nil, err
	}
	defer session.Conn.Close()

	baseMap, err := walkUint64(ctx, session, dot1dBasePortIfIndexOID)
	if err != nil {
		return nil, fmt.Errorf("dot1dBase walk: %w", err)
	}

	entries, err := walkMacTable(ctx, session, dot1qTpFdbPortOID, baseMap, true)
	if err != nil {
		return nil, err
	}

	if len(entries) == 0 {
		return walkMacTable(ctx, session, dot1dTpFdbPortOID, baseMap, false)
	}
	return entries, nil
}

// ProbeDevice performs a lightweight SNMP get to validate reachability.
func ProbeDevice(ctx context.Context, target config.Switch) (*ProbeResult, error) {
	session, err := newSession(target)
	if err != nil {
		return nil, err
	}
	session.Timeout = 2 * time.Second
	if err := session.Connect(); err != nil {
		return &ProbeResult{Reachable: false}, err
	}
	defer session.Conn.Close()
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	pkt, err := session.Get([]string{sysNameOID})
	if err != nil {
		return &ProbeResult{Reachable: false}, err
	}
	if len(pkt.Variables) == 0 {
		return &ProbeResult{Reachable: true}, nil
	}

	sysName := toString(pkt.Variables[0])
	return &ProbeResult{Reachable: true, Hostname: sysName}, nil
}

func newSession(target config.Switch) (*gosnmp.GoSNMP, error) {
	version := gosnmp.Version2c
	if strings.EqualFold(target.Version, "1") {
		version = gosnmp.Version1
	} else if strings.EqualFold(target.Version, "3") {
		return nil, errors.New("SNMPv3 not supported in this build")
	}

	timeout := target.Timeout.Duration
	if timeout == 0 {
		timeout = 5 * time.Second
	}
	retries := target.Retries
	if retries <= 0 {
		retries = 1
	}

	return &gosnmp.GoSNMP{
		Target:         target.Address,
		Port:           target.Port,
		Community:      target.Community,
		Version:        version,
		Timeout:        timeout,
		Retries:        retries,
		MaxRepetitions: 25,
	}, nil
}

func walkString(ctx context.Context, session *gosnmp.GoSNMP, oid string) (map[int]string, error) {
	result := make(map[int]string)
	err := session.Walk(oid, func(pdu gosnmp.SnmpPDU) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		idx := parseIndex(oid, pdu.Name)
		result[idx] = toString(pdu)
		return nil
	})
	if errors.Is(err, context.Canceled) {
		return nil, err
	}
	return result, err
}

func walkInt(ctx context.Context, session *gosnmp.GoSNMP, oid string) (map[int]int, error) {
	result := make(map[int]int)
	err := session.Walk(oid, func(pdu gosnmp.SnmpPDU) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		idx := parseIndex(oid, pdu.Name)
		result[idx] = int(toUint64(pdu))
		return nil
	})
	return result, err
}

func walkUint64(ctx context.Context, session *gosnmp.GoSNMP, oid string) (map[int]uint64, error) {
	result := make(map[int]uint64)
	err := session.Walk(oid, func(pdu gosnmp.SnmpPDU) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		idx := parseIndex(oid, pdu.Name)
		result[idx] = toUint64(pdu)
		return nil
	})
	return result, err
}

func walkMacTable(ctx context.Context, session *gosnmp.GoSNMP, oid string, basePortMap map[int]uint64, includeVLAN bool) ([]MACRecord, error) {
	var records []MACRecord
	err := session.Walk(oid, func(pdu gosnmp.SnmpPDU) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		tail := oidTail(oid, pdu.Name)
		idxParts := parseOIDParts(tail)
		var vlan *int
		macStart := 0
		if includeVLAN {
			if len(idxParts) < 7 {
				return nil
			}
			v := idxParts[0]
			vlan = &v
			macStart = 1
		} else {
			if len(idxParts) < 6 {
				return nil
			}
		}
		macParts := idxParts[macStart:]
		mac := formatMAC(macParts)
		basePort := int(toUint64(pdu))
		if basePort == 0 {
			return nil
		}
		ifIndex := int(basePortMap[basePort])
		if ifIndex == 0 {
			ifIndex = basePort
		}
		records = append(records, MACRecord{VLAN: vlan, MAC: mac, IfIndex: ifIndex})
		return nil
	})
	return records, err
}

func parseIndex(base, name string) int {
	tail := oidTail(base, name)
	parts := parseOIDParts(tail)
	if len(parts) == 0 {
		return 0
	}
	return parts[len(parts)-1]
}

func oidTail(base, full string) string {
	trimmed := strings.TrimPrefix(full, base)
	trimmed = strings.TrimPrefix(trimmed, base+".")
	trimmed = strings.TrimPrefix(trimmed, ".")
	return trimmed
}

func parseOIDParts(tail string) []int {
	if tail == "" {
		return nil
	}
	segments := strings.Split(tail, ".")
	parts := make([]int, 0, len(segments))
	for _, seg := range segments {
		if seg == "" {
			continue
		}
		var val int
		fmt.Sscanf(seg, "%d", &val)
		parts = append(parts, val)
	}
	return parts
}

func formatMAC(parts []int) string {
	if len(parts) < 6 {
		return ""
	}
	if len(parts) > 6 {
		parts = parts[:6]
	}
	bytes := make([]string, len(parts))
	for i, p := range parts {
		bytes[i] = fmt.Sprintf("%02x", p)
	}
	return strings.Join(bytes, ":")
}

func toString(pdu gosnmp.SnmpPDU) string {
	switch v := pdu.Value.(type) {
	case string:
		return v
	case []byte:
		return strings.TrimSpace(string(v))
	default:
		return fmt.Sprint(v)
	}
}

func toUint64(pdu gosnmp.SnmpPDU) uint64 {
	switch v := pdu.Value.(type) {
	case uint:
		return uint64(v)
	case uint32:
		return uint64(v)
	case uint64:
		return v
	case int:
		if v < 0 {
			return 0
		}
		return uint64(v)
	case int64:
		if v < 0 {
			return 0
		}
		return uint64(v)
	case []byte:
		return bytesToUint64(v)
	default:
		return 0
	}
}

func bytesToUint64(b []byte) uint64 {
	var out uint64
	for _, by := range b {
		out = (out << 8) | uint64(by)
	}
	return out
}

// NextIP returns the next host IP in a prefix.
func NextIP(ip net.IP) net.IP {
	res := make(net.IP, len(ip))
	copy(res, ip)
	for j := len(res) - 1; j >= 0; j-- {
		res[j]++
		if res[j] != 0 {
			break
		}
	}
	return res
}

// IPsFromCIDR expands IPv4 prefixes.
func IPsFromCIDR(cidr string, limit int) ([]string, error) {
	_, network, err := net.ParseCIDR(cidr)
	if err != nil {
		return nil, err
	}
	ip := network.IP.Mask(network.Mask)
	var ips []string
	count := 0
	for ip := ip; network.Contains(ip); ip = NextIP(ip) {
		if limit > 0 && count >= limit {
			break
		}
		// Skip network/broadcast for IPv4
		if network.IP.Equal(ip) || isBroadcast(ip, network.Mask) {
			continue
		}
		ips = append(ips, ip.String())
		count++
	}
	return ips, nil
}

func isBroadcast(ip net.IP, mask net.IPMask) bool {
	if len(ip.To4()) != net.IPv4len {
		return false
	}
	broadcast := make(net.IP, len(ip.To4()))
	for i := 0; i < net.IPv4len; i++ {
		broadcast[i] = ip[i] | ^mask[i]
	}
	return ip.Equal(broadcast)
}

// ClampCounter prevents wrap-around issues for delta calculations.
func ClampCounter(current, previous uint64) uint64 {
	if current < previous {
		return current
	}
	return current - previous
}

// BitsPerSecond converts byte deltas over duration.
func BitsPerSecond(bytesDelta uint64, interval time.Duration) float64 {
	if interval <= 0 {
		return 0
	}
	return float64(bytesDelta*8) / interval.Seconds()
}

// ErrorRate calculates error ratios.
func ErrorRate(errorDelta, octetDelta uint64) float64 {
	if octetDelta == 0 {
		return 0
	}
	return float64(errorDelta) / float64(octetDelta)
}
