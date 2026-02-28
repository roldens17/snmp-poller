package server

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/fresatu/snmp-poller/internal/devicereg"
)

func (s *HTTPServer) handleTestSNMP(c *gin.Context) {
	var req devicereg.TestSNMPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	tenantID := s.getTenantID(c)
	result, token, err := s.deviceReg.TestSNMP(c.Request.Context(), tenantID, req)
	if err != nil {
		var snmpErr *devicereg.SNMPTestError
		if errors.As(err, &snmpErr) {
			c.JSON(http.StatusOK, gin.H{
				"ok":         false,
				"error_code": snmpErr.Code,
				"message":    snmpErr.Message,
				"details":    gin.H{"raw": snmpErr.Err.Error()},
			})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":                 true,
		"sys_name":           result.SysName,
		"reachable":          true,
		"interfaces_count":   result.InterfacesCount,
		"uptime_seconds":     result.UptimeSeconds,
		"supports_mac_table": result.SupportsMacTable,
		"notes":              result.Notes,
		"test_token":         token,
	})
}

func (s *HTTPServer) handleCreateDevice(c *gin.Context) {
	var req devicereg.CreateDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	tenantID := s.getTenantID(c)
	if tenant, ok := s.getAuthTenant(c); ok && tenant != nil && tenant.MaxDevices > 0 {
		count, err := s.store.CountDevices(c.Request.Context(), tenantID)
		if err == nil && count >= tenant.MaxDevices {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error": "plan device limit reached",
				"code": "PLAN_LIMIT_DEVICES",
				"max_devices": tenant.MaxDevices,
				"device_count": count,
			})
			return
		}
	}
	device, err := s.deviceReg.CreateDevice(c.Request.Context(), tenantID, req)
	if err != nil {
		var existsErr *devicereg.DeviceExistsError
		if errors.As(err, &existsErr) {
			c.JSON(http.StatusConflict, gin.H{
				"error_code": "DEVICE_EXISTS",
				"message":    "A device with this IP already exists in this tenant.",
				"device_id":  existsErr.DeviceID,
				"ip":         existsErr.IP,
			})
			return
		}
		if strings.Contains(err.Error(), "snmp test token") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "required") || strings.Contains(err.Error(), "snmp") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		log.Warn().Err(err).Msg("create device failed")
		s.respondErr(c, err)
		return
	}
	s.addAudit(c, "device.create", "device", fmt.Sprintf("%d", device.ID), fmt.Sprintf(`{"hostname":%q,"mgmt_ip":%q}`, device.Hostname, device.MgmtIP))
	c.JSON(http.StatusCreated, device)
}
