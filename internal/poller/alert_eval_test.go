package poller

import (
	"testing"
	"time"

	"github.com/fresatu/snmp-poller/internal/snmpclient"
	"github.com/fresatu/snmp-poller/internal/store"
)

// defaultCfg mirrors the production defaults from config.applyDefaults.
var defaultCfg = alertingConfig{
	InterfaceDownAfter: 2 * time.Minute,
	ErrorRateThreshold: 0.05,
	BandwidthThreshold: 0.80,
}

var baseTime = time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)

// findAction finds the first action for the given ifIndex and category.
func findAction(actions []alertAction, ifIndex int, category string) (alertAction, bool) {
	for _, a := range actions {
		if a.ifIndex == ifIndex && a.category == category {
			return a, true
		}
	}
	return alertAction{}, false
}

// --- Interface down alerts ---

func TestInterfaceDown_RaisesWhenDownLongEnough(t *testing.T) {
	statusChangedAt := baseTime.Add(-3 * time.Minute) // down for 3m > 2m threshold
	metrics := []snmpclient.InterfaceMetric{
		{Index: 1, Name: "eth0", Admin: "up", Oper: "down"},
	}
	prev := map[int]store.InterfaceState{
		1: {OperStatus: "down", StatusChangedAt: statusChangedAt},
	}
	actions := computeAlertActions(defaultCfg, baseTime, metrics, prev, nil)
	a, ok := findAction(actions, 1, "interface_down")
	if !ok {
		t.Fatal("expected interface_down action, none found")
	}
	if a.action != "raise" {
		t.Errorf("expected raise, got %q", a.action)
	}
	if a.severity != "warning" {
		t.Errorf("expected warning severity, got %q", a.severity)
	}
}

func TestInterfaceDown_NoRaiseWhenUnderThreshold(t *testing.T) {
	statusChangedAt := baseTime.Add(-1 * time.Minute) // only 1m, threshold is 2m
	metrics := []snmpclient.InterfaceMetric{
		{Index: 1, Name: "eth0", Admin: "up", Oper: "down"},
	}
	prev := map[int]store.InterfaceState{
		1: {OperStatus: "down", StatusChangedAt: statusChangedAt},
	}
	actions := computeAlertActions(defaultCfg, baseTime, metrics, prev, nil)
	if a, ok := findAction(actions, 1, "interface_down"); ok && a.action == "raise" {
		t.Error("should not raise interface_down alert before threshold")
	}
}

func TestInterfaceDown_NoRaiseWithoutHistory(t *testing.T) {
	metrics := []snmpclient.InterfaceMetric{
		{Index: 1, Name: "eth0", Admin: "up", Oper: "down"},
	}
	// no previous state
	actions := computeAlertActions(defaultCfg, baseTime, metrics, nil, nil)
	if a, ok := findAction(actions, 1, "interface_down"); ok && a.action == "raise" {
		t.Error("should not raise interface_down when no history exists")
	}
}

func TestInterfaceDown_NoRaiseWhenPrevOperStatusEmpty(t *testing.T) {
	// OperStatus="" means first time we've seen this interface — don't alert yet.
	statusChangedAt := baseTime.Add(-5 * time.Minute)
	metrics := []snmpclient.InterfaceMetric{
		{Index: 1, Name: "eth0", Admin: "up", Oper: "down"},
	}
	prev := map[int]store.InterfaceState{
		1: {OperStatus: "", StatusChangedAt: statusChangedAt},
	}
	actions := computeAlertActions(defaultCfg, baseTime, metrics, prev, nil)
	if a, ok := findAction(actions, 1, "interface_down"); ok && a.action == "raise" {
		t.Error("should not raise interface_down when prevState.OperStatus is empty")
	}
}

func TestInterfaceDown_ClearsWhenInterfaceComesUp(t *testing.T) {
	metrics := []snmpclient.InterfaceMetric{
		{Index: 1, Name: "eth0", Admin: "up", Oper: "up"},
	}
	actions := computeAlertActions(defaultCfg, baseTime, metrics, nil, nil)
	a, ok := findAction(actions, 1, "interface_down")
	if !ok {
		t.Fatal("expected interface_down clear action")
	}
	if a.action != "clear" {
		t.Errorf("expected clear, got %q", a.action)
	}
}

func TestInterfaceDown_AdminDownNotAlerting(t *testing.T) {
	// Admin=down means intentionally shut down; ifDown = admin=="up" && oper!="up"
	// so admin=down → ifDown=false → we emit a clear, not a raise.
	metrics := []snmpclient.InterfaceMetric{
		{Index: 1, Name: "eth0", Admin: "down", Oper: "down"},
	}
	actions := computeAlertActions(defaultCfg, baseTime, metrics, nil, nil)
	if a, ok := findAction(actions, 1, "interface_down"); ok && a.action == "raise" {
		t.Error("admin-down interfaces should not trigger interface_down alert")
	}
}

// --- Error rate alerts ---

func makeCounters(ifIndex int, inOctets, outOctets, inErrors, outErrors uint64, age time.Duration) map[int]store.InterfaceCounters {
	return map[int]store.InterfaceCounters{
		ifIndex: {
			InOctets:    inOctets,
			OutOctets:   outOctets,
			InErrors:    inErrors,
			OutErrors:   outErrors,
			CollectedAt: baseTime.Add(-age),
		},
	}
}

func TestErrorRate_RaisesAboveThreshold(t *testing.T) {
	// threshold=0.05; errors/octets = 100/1000 = 0.10 > 0.05
	metrics := []snmpclient.InterfaceMetric{
		{Index: 1, Name: "eth0", Admin: "up", Oper: "up", InOctets: 1000, InErrors: 100},
	}
	prev := makeCounters(1, 0, 0, 0, 0, 30*time.Second)
	actions := computeAlertActions(defaultCfg, baseTime, metrics, nil, prev)
	a, ok := findAction(actions, 1, "error_rate")
	if !ok {
		t.Fatal("expected error_rate action")
	}
	if a.action != "raise" {
		t.Errorf("expected raise, got %q", a.action)
	}
}

func TestErrorRate_ClearsBelowThreshold(t *testing.T) {
	// errors/octets = 1/1000 = 0.001 < 0.05
	metrics := []snmpclient.InterfaceMetric{
		{Index: 1, Name: "eth0", Admin: "up", Oper: "up", InOctets: 1000, InErrors: 1},
	}
	prev := makeCounters(1, 0, 0, 0, 0, 30*time.Second)
	actions := computeAlertActions(defaultCfg, baseTime, metrics, nil, prev)
	a, ok := findAction(actions, 1, "error_rate")
	if !ok {
		t.Fatal("expected error_rate action")
	}
	if a.action != "clear" {
		t.Errorf("expected clear, got %q", a.action)
	}
}

func TestErrorRate_SkipsWhenNoPreviousCounters(t *testing.T) {
	metrics := []snmpclient.InterfaceMetric{
		{Index: 1, Name: "eth0", Admin: "up", Oper: "up", InOctets: 1000, InErrors: 100},
	}
	actions := computeAlertActions(defaultCfg, baseTime, metrics, nil, nil)
	if _, ok := findAction(actions, 1, "error_rate"); ok {
		t.Error("should not evaluate error_rate without previous counters")
	}
}

func TestErrorRate_NoAlertWhenZeroOctetDelta(t *testing.T) {
	// Both current and previous octets are zero → octetDelta=0 → ErrorRate returns 0
	metrics := []snmpclient.InterfaceMetric{
		{Index: 1, Name: "eth0", Admin: "up", Oper: "up", InOctets: 0, InErrors: 0},
	}
	prev := makeCounters(1, 0, 0, 0, 0, 30*time.Second)
	actions := computeAlertActions(defaultCfg, baseTime, metrics, nil, prev)
	if a, ok := findAction(actions, 1, "error_rate"); ok && a.action == "raise" {
		t.Error("should not raise error_rate when octet delta is zero")
	}
}

// --- Bandwidth alerts ---

func TestBandwidth_RaisesAboveThreshold(t *testing.T) {
	// speed=1000 bps, threshold=80%, bps = 900 bytes/s * 8 = 7200 bps > 800 bps threshold
	metrics := []snmpclient.InterfaceMetric{
		{Index: 1, Name: "eth0", Admin: "up", Oper: "up", Speed: 1000, InOctets: 900},
	}
	prev := makeCounters(1, 0, 0, 0, 0, time.Second)
	actions := computeAlertActions(defaultCfg, baseTime, metrics, nil, prev)
	a, ok := findAction(actions, 1, "bandwidth")
	if !ok {
		t.Fatal("expected bandwidth action")
	}
	if a.action != "raise" {
		t.Errorf("expected raise, got %q", a.action)
	}
}

func TestBandwidth_ClearsBelowThreshold(t *testing.T) {
	// speed=10000 bps, 80% threshold=8000 bps; actual=8 bps (1 byte/s * 8)
	metrics := []snmpclient.InterfaceMetric{
		{Index: 1, Name: "eth0", Admin: "up", Oper: "up", Speed: 10000, InOctets: 1},
	}
	prev := makeCounters(1, 0, 0, 0, 0, time.Second)
	actions := computeAlertActions(defaultCfg, baseTime, metrics, nil, prev)
	a, ok := findAction(actions, 1, "bandwidth")
	if !ok {
		t.Fatal("expected bandwidth action")
	}
	if a.action != "clear" {
		t.Errorf("expected clear, got %q", a.action)
	}
}

func TestBandwidth_SkipsWhenSpeedIsZero(t *testing.T) {
	metrics := []snmpclient.InterfaceMetric{
		{Index: 1, Name: "eth0", Admin: "up", Oper: "up", Speed: 0, InOctets: 1000},
	}
	prev := makeCounters(1, 0, 0, 0, 0, time.Second)
	actions := computeAlertActions(defaultCfg, baseTime, metrics, nil, prev)
	if _, ok := findAction(actions, 1, "bandwidth"); ok {
		t.Error("should not evaluate bandwidth when speed is zero")
	}
}
