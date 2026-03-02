package alerts

import "strings"

// classifyError maps low-level poll errors to UX-friendly incident categories.
func classifyError(err error) (kind, title, message string) {
	if err == nil {
		return "", "", ""
	}
	s := strings.ToLower(err.Error())
	switch {
	case strings.Contains(s, "connection refused"):
		return "CONNECTION_REFUSED", "Device unreachable", "SNMP UDP connection refused"
	case strings.Contains(s, "i/o timeout"), strings.Contains(s, "timeout"):
		return "TIMEOUT", "Device unreachable", "SNMP request timed out"
	case strings.Contains(s, "authentication"), strings.Contains(s, "auth"), strings.Contains(s, "unknown user name"), strings.Contains(s, "wrongdigest"):
		return "AUTH", "SNMP auth failed", "SNMP authentication failure"
	case strings.Contains(s, "no route to host"):
		return "NO_ROUTE", "No route to host", "Routing/firewall issue"
	default:
		return "UNKNOWN", "Poll failed", "SNMP poll error"
	}
}
