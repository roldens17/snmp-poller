package devicereg

import "fmt"

// DeviceExistsError indicates a device already exists for tenant+ip.
type DeviceExistsError struct {
	DeviceID int64
	IP       string
}

func (e *DeviceExistsError) Error() string {
	return fmt.Sprintf("device already exists for ip %s", e.IP)
}
