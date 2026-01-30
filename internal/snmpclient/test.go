package snmpclient

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gosnmp/gosnmp"
)

// V3Config captures SNMPv3 parameters.
type V3Config struct {
	Username     string
	AuthProtocol string
	AuthPassword string
	PrivProtocol string
	PrivPassword string
}

// TestConfig defines connection settings for SNMP test.
type TestConfig struct {
	Address   string
	Version   string
	Community string
	V3        V3Config
	Timeout   time.Duration
	Retries   int
}

// TestResult reports SNMP test findings.
type TestResult struct {
	SysName          string
	InterfacesCount  int
	UptimeSeconds    uint64
	SupportsMacTable bool
	Notes            []string
}

var (
	ifNumberOID  = "1.3.6.1.2.1.2.1.0"
	sysUpTimeOID = "1.3.6.1.2.1.1.3.0"
)

// TestConnection probes basic SNMP information.
func TestConnection(ctx context.Context, cfg TestConfig) (*TestResult, error) {
	session, err := newTestSession(cfg)
	if err != nil {
		return nil, err
	}
	if err := session.Connect(); err != nil {
		return nil, err
	}
	defer session.Conn.Close()

	oids := []string{sysNameOID, ifNumberOID, sysUpTimeOID}
	pkt, err := session.Get(oids)
	if err != nil {
		return nil, err
	}

	out := &TestResult{}
	for _, v := range pkt.Variables {
		switch v.Name {
		case sysNameOID:
			out.SysName = toString(v)
		case ifNumberOID:
			out.InterfacesCount = int(toUint64(v))
		case sysUpTimeOID:
			// sysUpTime is in hundredths of seconds.
			out.UptimeSeconds = toUint64(v) / 100
		}
	}

	notes := []string{}
	macSupported, err := supportsMacTable(ctx, session)
	if err != nil {
		notes = append(notes, fmt.Sprintf("MAC table check skipped: %v", err))
	}
	out.SupportsMacTable = macSupported
	out.Notes = notes

	return out, nil
}

func newTestSession(cfg TestConfig) (*gosnmp.GoSNMP, error) {
	if strings.TrimSpace(cfg.Address) == "" {
		return nil, errors.New("target address missing")
	}
	version := strings.TrimSpace(strings.ToLower(cfg.Version))
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 5 * time.Second
	}
	retries := cfg.Retries
	if retries <= 0 {
		retries = 1
	}

	switch version {
	case "2c":
		return &gosnmp.GoSNMP{
			Target:    cfg.Address,
			Port:      161,
			Community: cfg.Community,
			Version:   gosnmp.Version2c,
			Timeout:   timeout,
			Retries:   retries,
		}, nil
	case "3":
		authProto, err := resolveAuthProtocol(cfg.V3.AuthProtocol)
		if err != nil {
			return nil, err
		}
		privProto, err := resolvePrivProtocol(cfg.V3.PrivProtocol)
		if err != nil {
			return nil, err
		}
		sp := &gosnmp.UsmSecurityParameters{
			UserName:                 cfg.V3.Username,
			AuthenticationProtocol:   authProto,
			AuthenticationPassphrase: cfg.V3.AuthPassword,
			PrivacyProtocol:          privProto,
			PrivacyPassphrase:        cfg.V3.PrivPassword,
		}
		return &gosnmp.GoSNMP{
			Target:             cfg.Address,
			Port:               161,
			Version:            gosnmp.Version3,
			Timeout:            timeout,
			Retries:            retries,
			SecurityModel:      gosnmp.UserSecurityModel,
			MsgFlags:           gosnmp.AuthPriv,
			SecurityParameters: sp,
		}, nil
	default:
		return nil, errors.New("unsupported SNMP version")
	}
}

func resolveAuthProtocol(raw string) (gosnmp.SnmpV3AuthProtocol, error) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "SHA":
		return gosnmp.SHA, nil
	case "MD5":
		return gosnmp.MD5, nil
	default:
		return gosnmp.NoAuth, fmt.Errorf("unsupported auth protocol")
	}
}

func resolvePrivProtocol(raw string) (gosnmp.SnmpV3PrivProtocol, error) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "AES":
		return gosnmp.AES, nil
	case "DES":
		return gosnmp.DES, nil
	default:
		return gosnmp.NoPriv, fmt.Errorf("unsupported privacy protocol")
	}
}

func supportsMacTable(ctx context.Context, session *gosnmp.GoSNMP) (bool, error) {
	baseMap, err := walkUint64(ctx, session, dot1dBasePortIfIndexOID)
	if err != nil {
		return false, err
	}
	entries, err := walkMacTable(ctx, session, dot1qTpFdbPortOID, baseMap, true)
	if err == nil && len(entries) > 0 {
		return true, nil
	}
	if err != nil {
		return false, err
	}
	entries, err = walkMacTable(ctx, session, dot1dTpFdbPortOID, baseMap, false)
	if err != nil {
		return false, err
	}
	return true, nil
}
