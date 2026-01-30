package devicereg

import (
	"net"
	"strings"
)

func normalizeAddress(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return trimmed
	}
	if strings.Contains(trimmed, "/") {
		if ip, _, err := net.ParseCIDR(trimmed); err == nil && ip != nil {
			return ip.String()
		}
	}
	if ip := net.ParseIP(trimmed); ip != nil {
		return ip.String()
	}
	return trimmed
}
