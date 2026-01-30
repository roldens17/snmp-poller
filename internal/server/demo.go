package server

import (
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"github.com/fresatu/snmp-poller/internal/store"
	"github.com/gin-gonic/gin"
)

func (s *HTTPServer) handleDemoSeed(c *gin.Context) {
	if !s.cfg.DemoMode {
		c.JSON(http.StatusNotFound, gin.H{"error": "demo mode disabled"})
		return
	}

	user, ok := s.getAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if user.Role != "owner" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	demoTenants := []struct {
		Name string
		Slug string
	}{
		{"Default Tenant", "default"},
		{"Other Tenant", "other"},
		{"Tenant B", "tenant-b"},
	}

	stats := gin.H{
		"tenants_seeded": 0,
		"devices_seeded": 0,
		"alerts_seeded":  0,
		"macs_seeded":    0,
	}

	for _, dt := range demoTenants {
		// 1. Ensure Tenant Exists
		var tenant *store.Tenant
		t, err := s.store.GetTenantBySlug(c.Request.Context(), dt.Slug)
		if err == nil {
			tenant = t
		} else {
			// Create it
			newT, err := s.store.CreateTenant(c.Request.Context(), dt.Name, dt.Slug)
			if err != nil {
				s.respondErr(c, err)
				return
			}
			tenant = newT
			stats["tenants_seeded"] = stats["tenants_seeded"].(int) + 1
		}

		// 2. Ensure Membership
		tenants, err := s.store.GetUserTenants(c.Request.Context(), user.ID)
		if err != nil {
			s.respondErr(c, err)
			return
		}
		isMember := false
		for _, ut := range tenants {
			if ut.ID == tenant.ID {
				isMember = true
				break
			}
		}
		if !isMember {
			if err := s.store.AddUserToTenant(c.Request.Context(), user.ID, tenant.ID, "owner"); err != nil {
				s.respondErr(c, err)
				return
			}
		}

		// 3. Populate Data (Idempotent-ish: won't duplicate if hostname conflict, but we use random hostnames usually)
		// To make it simple, we'll confirm if we need to seed by checking device count
		existingDevices, err := s.store.ListDevices(c.Request.Context(), tenant.ID, store.DeviceFilter{})
		if err != nil {
			s.respondErr(c, err)
			return
		}

		if len(existingDevices) < 5 {
			// Seed Devices
			deviceCount := rand.Intn(13) + 8 // 8 to 20
			for i := 0; i < deviceCount; i++ {
				devName := fmt.Sprintf("demo-%s-%03d", dt.Slug, i+1)
				site := []string{"HQ", "Branch A", "Branch B", "Datacenter"}[rand.Intn(4)]
				kind := []string{"Switch", "Router", "Firewall", "AP"}[rand.Intn(4)]

				lastSeen := time.Now().Add(-time.Duration(rand.Intn(1000)) * time.Minute)
				dev := &store.Device{
					TenantID:    tenant.ID,
					Hostname:    devName,
					MgmtIP:      fmt.Sprintf("10.%d.%d.%d", rand.Intn(255), rand.Intn(255), rand.Intn(254)+1),
					Community:   "public",
					Enabled:     true,
					Site:        site,
					Description: fmt.Sprintf("Demo %s at %s", kind, site),
					LastSeen:    &lastSeen,
					Status:      "active",
				}
				devID, err := s.store.UpsertDevice(c.Request.Context(), dev)
				if err != nil {
					continue
				} else {
					stats["devices_seeded"] = stats["devices_seeded"].(int) + 1
				}

				// Seed MACs for this device
				macCount := rand.Intn(25) + 5
				macEntries := []store.MACEntry{}
				for m := 0; m < macCount; m++ {
					vlan := rand.Intn(4094) + 1
					ifIndex := rand.Intn(48) + 1
					mac := fmt.Sprintf("%02x:%02x:%02x:%02x:%02x:%02x",
						rand.Intn(256), rand.Intn(256), rand.Intn(256),
						rand.Intn(256), rand.Intn(256), rand.Intn(256))

					macEntries = append(macEntries, store.MACEntry{
						DeviceID:  devID,
						TenantID:  tenant.ID,
						VLAN:      &vlan,
						MAC:       mac,
						IfIndex:   &ifIndex,
						FirstSeen: time.Now().Add(-24 * time.Hour),
						LastSeen:  time.Now(),
					})
				}
				if err := s.store.UpsertMacEntries(c.Request.Context(), macEntries); err == nil {
					stats["macs_seeded"] = stats["macs_seeded"].(int) + len(macEntries)
				}

				// Seed Alerts
				if rand.Float32() < 0.4 { // 40% chance of alert
					alertMsg := []string{"Interface down", "High CPU", "SNMP timeout", "Loop detected"}[rand.Intn(4)]
					severity := []string{"critical", "warning", "info"}[rand.Intn(3)]
					trigger := time.Now().Add(-time.Duration(rand.Intn(300)) * time.Minute)
					var resolved *time.Time
					if rand.Float32() < 0.5 {
						r := trigger.Add(time.Minute * 10)
						resolved = &r
					}

					alert := &store.Alert{
						TenantID:    tenant.ID,
						DeviceID:    devID,
						Category:    "demo",
						Severity:    severity,
						Message:     alertMsg,
						TriggeredAt: trigger,
						ResolvedAt:  resolved,
					}
					if _, _, err := s.store.UpsertAlert(c.Request.Context(), *alert); err == nil {
						stats["alerts_seeded"] = stats["alerts_seeded"].(int) + 1
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "stats": stats})
}

func (s *HTTPServer) handleDemoReset(c *gin.Context) {
	if !s.cfg.DemoMode {
		c.JSON(http.StatusNotFound, gin.H{"error": "demo mode disabled"})
		return
	}

	user, ok := s.getAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if user.Role != "owner" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	// Delete devices/alerts/macs for demo tenants
	// We'll look up the tenants by slug again
	slugs := []string{"default", "other", "tenant-b"}
	for _, slug := range slugs {
		t, err := s.store.GetTenantBySlug(c.Request.Context(), slug)
		if err == nil {
			// Use store method to avoid raw SQL here
			_ = s.store.DeleteDemoData(c.Request.Context(), t.ID)
		}
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
