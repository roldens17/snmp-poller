package snmpclient

import (
	"math"
	"testing"
	"time"
)

// --- ClampCounter ---

func TestClampCounter(t *testing.T) {
	cases := []struct {
		name     string
		current  uint64
		previous uint64
		want     uint64
	}{
		{"normal delta", 100, 50, 50},
		{"no change", 50, 50, 0},
		{"first poll previous zero", 1000, 0, 1000},
		{"both zero", 0, 0, 0},
		// Counter wrap/reset: current < previous. ClampCounter returns current
		// (the post-reset value) rather than computing a wrap-around delta.
		// This is a conservative "clamp" — it avoids inflated spikes on wrap.
		{"counter wrap small", 10, 10000, 10},
		{"counter wrap near max", 5, math.MaxUint64 - 10, 5},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ClampCounter(tc.current, tc.previous)
			if got != tc.want {
				t.Errorf("ClampCounter(%d, %d) = %d; want %d", tc.current, tc.previous, got, tc.want)
			}
		})
	}
}

// --- BitsPerSecond ---

func TestBitsPerSecond(t *testing.T) {
	cases := []struct {
		name     string
		bytes    uint64
		interval time.Duration
		want     float64
	}{
		{"normal 1s", 1000, time.Second, 8000},
		{"sub-second", 1000, 500 * time.Millisecond, 16000},
		{"zero bytes", 0, time.Second, 0},
		{"zero interval", 1000, 0, 0},
		{"negative interval", 1000, -time.Second, 0},
		{"two seconds", 1000, 2 * time.Second, 4000},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := BitsPerSecond(tc.bytes, tc.interval)
			if got != tc.want {
				t.Errorf("BitsPerSecond(%d, %v) = %f; want %f", tc.bytes, tc.interval, got, tc.want)
			}
		})
	}
}

// --- ErrorRate ---

func TestErrorRate(t *testing.T) {
	cases := []struct {
		name    string
		errors  uint64
		octets  uint64
		want    float64
	}{
		{"normal ratio", 5, 1000, 0.005},
		{"zero octets div-by-zero guard", 5, 0, 0},
		{"zero errors", 0, 1000, 0},
		{"both zero", 0, 0, 0},
		{"100 percent", 100, 100, 1.0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ErrorRate(tc.errors, tc.octets)
			if got != tc.want {
				t.Errorf("ErrorRate(%d, %d) = %f; want %f", tc.errors, tc.octets, got, tc.want)
			}
		})
	}
}

// --- IPsFromCIDR ---

func TestIPsFromCIDR(t *testing.T) {
	t.Run("/30 gives 2 hosts", func(t *testing.T) {
		ips, err := IPsFromCIDR("192.168.1.0/30", 0)
		if err != nil {
			t.Fatal(err)
		}
		if len(ips) != 2 {
			t.Fatalf("want 2 hosts, got %d: %v", len(ips), ips)
		}
		if ips[0] != "192.168.1.1" || ips[1] != "192.168.1.2" {
			t.Errorf("unexpected hosts: %v", ips)
		}
	})

	t.Run("/32 gives 0 hosts", func(t *testing.T) {
		ips, err := IPsFromCIDR("10.0.0.1/32", 0)
		if err != nil {
			t.Fatal(err)
		}
		if len(ips) != 0 {
			t.Errorf("want 0 hosts, got %d", len(ips))
		}
	})

	t.Run("/24 with limit", func(t *testing.T) {
		ips, err := IPsFromCIDR("10.0.0.0/24", 5)
		if err != nil {
			t.Fatal(err)
		}
		if len(ips) != 5 {
			t.Errorf("want 5, got %d", len(ips))
		}
	})

	t.Run("invalid CIDR returns error", func(t *testing.T) {
		_, err := IPsFromCIDR("not-a-cidr", 0)
		if err == nil {
			t.Error("expected error for invalid CIDR")
		}
	})
}

// --- formatMAC ---

func TestFormatMAC(t *testing.T) {
	cases := []struct {
		name  string
		parts []int
		want  string
	}{
		{"normal 6 parts", []int{0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e}, "00:1a:2b:3c:4d:5e"},
		{"too short", []int{1, 2, 3}, ""},
		{"too long truncated", []int{0, 1, 2, 3, 4, 5, 6, 7}, "00:01:02:03:04:05"},
		{"all zeros", []int{0, 0, 0, 0, 0, 0}, "00:00:00:00:00:00"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := formatMAC(tc.parts)
			if got != tc.want {
				t.Errorf("formatMAC(%v) = %q; want %q", tc.parts, got, tc.want)
			}
		})
	}
}

// --- parseOIDParts ---

func TestParseOIDParts(t *testing.T) {
	cases := []struct {
		name string
		tail string
		want []int
	}{
		{"normal", "1.2.3", []int{1, 2, 3}},
		{"empty", "", nil},
		{"leading dot", ".1.2.3", []int{1, 2, 3}},
		{"single segment", "42", []int{42}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := parseOIDParts(tc.tail)
			if len(got) != len(tc.want) {
				t.Fatalf("parseOIDParts(%q) = %v; want %v", tc.tail, got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Errorf("parseOIDParts(%q)[%d] = %d; want %d", tc.tail, i, got[i], tc.want[i])
				}
			}
		})
	}
}
