package devicereg

import (
	"errors"
	"net"
	"strings"
)

func mapSNMPError(err error) (string, string) {
	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		return "DNS_FAILED", "Unable to resolve hostname. Check the address and DNS configuration."
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return "TIMEOUT", "Timed out reaching the device. Verify the IP, firewall, and SNMP port."
	}
	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "timeout") {
		return "TIMEOUT", "Timed out reaching the device. Verify the IP, firewall, and SNMP port."
	}
	if strings.Contains(msg, "authentication") || strings.Contains(msg, "authorization") || strings.Contains(msg, "unknown user") {
		return "AUTH_FAILED", "Authentication failed. Double-check SNMP credentials and protocols."
	}
	return "UNKNOWN", "Unable to reach the device with the provided SNMP settings."
}
