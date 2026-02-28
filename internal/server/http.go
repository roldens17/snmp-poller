package server

import (
	"context"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"time"

	"golang.org/x/time/rate"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog/log"

	"github.com/fresatu/snmp-poller/internal/auth"
	"github.com/fresatu/snmp-poller/internal/config"
	"github.com/fresatu/snmp-poller/internal/devicereg"
	"github.com/fresatu/snmp-poller/internal/security"
	"github.com/fresatu/snmp-poller/internal/store"
)

// HTTPServer exposes REST + metrics endpoints.
type HTTPServer struct {
	cfg         *config.Config
	store       *store.Store
	auth        *auth.Service
	deviceReg   DeviceRegistrar
	loginLimiter *IPRateLimiter
}

type macEntryView struct {
	DeviceID        int64     `json:"device_id"`
	DeviceHostname  string    `json:"device_hostname,omitempty"`
	DeviceMgmtIP    string    `json:"device_mgmt_ip,omitempty"`
	DeviceSite      string    `json:"device_site,omitempty"`
	VLAN            *int      `json:"vlan"`
	MAC             string    `json:"mac"`
	IfIndex         *int      `json:"if_index"`
	PortName        string    `json:"port_name,omitempty"`
	PortDescr       string    `json:"port_descr,omitempty"`
	PortOperStatus  string    `json:"port_oper_status,omitempty"`
	PortAdminStatus string    `json:"port_admin_status,omitempty"`
	FirstSeen       time.Time `json:"first_seen"`
	LastSeen        time.Time `json:"last_seen"`
}

// NewHTTPServer configures the API server.
func NewHTTPServer(cfg *config.Config, db *store.Store) *HTTPServer {
	encryptor, err := security.NewEncryptorFromEnv()
	if err != nil {
		log.Warn().Err(err).Msg("device registration encryption disabled")
	}
	return &HTTPServer{
		cfg:         cfg,
		store:       db,
		auth:        auth.NewService(cfg.Auth),
		deviceReg:   devicereg.NewService(db, encryptor),
		loginLimiter: NewIPRateLimiter(rate.Limit(float64(cfg.Auth.LoginRatePerMinute)/60.0), cfg.Auth.LoginBurst),
	}
}

// Run starts the HTTP listener until ctx cancellation.
func (s *HTTPServer) Run(ctx context.Context) error {
	if s.cfg.HTTP.EnableDebug {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}
	engine := gin.New()
	engine.Use(gin.Recovery())
	engine.Use(func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("X-XSS-Protection", "0")
		if c.Request.TLS != nil {
			h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		c.Next()
	})
	engine.Use(func(c *gin.Context) {
		start := time.Now()
		c.Next()
		latency := time.Since(start)
		status := c.Writer.Status()
		log.Info().
			Str("method", c.Request.Method).
			Str("path", c.FullPath()).
			Int("status", status).
			Dur("latency", latency).
			Msg("http request")
	})
	// Allow browser clients on the Vite dev host to call the API.
	engine.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		allowed := false
		for _, candidate := range s.cfg.HTTP.AllowedOrigins {
			if origin == candidate {
				allowed = true
				break
			}
		}
		if allowed {
			h := c.Writer.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Vary", "Origin")
			h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID")
			h.Set("Access-Control-Allow-Credentials", "true")
			if c.Request.Method == http.MethodOptions {
				c.AbortWithStatus(http.StatusNoContent)
				return
			}
		} else if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	engine.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"name":    "snmp-poller",
			"status":  "ok",
			"version": "dev",
			"routes": []string{
				"/health",
				"/healthz",
				"/devices",
				"/alerts",
				"/macs",
				"/metrics",
			},
		})
	})

	health := func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "time": time.Now().UTC()})
	}
	engine.GET("/healthz", health)
	engine.GET("/health", health)
	engine.GET("/readyz", func(c *gin.Context) {
		if err := s.store.Ping(c.Request.Context()); err != nil {
			log.Error().Err(err).Msg("readiness check failed")
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	engine.POST("/auth/login", s.handleAuthLogin)
	engine.POST("/auth/logout", s.handleAuthLogout)
	engine.GET("/auth/me", s.authRequired(), s.handleAuthMe)
	engine.POST("/auth/register", s.handleAuthRegister)

	protected := engine.Group("/")
	protected.Use(s.authRequired())
	protected.GET("/system/status", s.handleSystemStatus)
	protected.GET("/tenants", s.handleListTenants)
	protected.GET("/tenants/active", s.handleGetActiveTenant)
	protected.POST("/tenants/active", s.handleSwitchTenant)

	log.Info().Bool("demo_mode", s.cfg.DemoMode).Msg("server config")

	if s.cfg.DemoMode {
		protected.POST("/demo/seed", s.handleDemoSeed)
		protected.POST("/demo/reset", s.handleDemoReset)
	}

	protected.GET("/devices", s.handleListDevices)
	protected.GET("/devices/:id", s.handleGetDevice)
	protected.GET("/devices/:id/interfaces", s.handleDeviceInterfaces)
	protected.GET("/devices/:id/macs", s.handleDeviceMacs)
	protected.POST("/devices/test-snmp", s.handleTestSNMP)
	protected.POST("/devices", s.handleCreateDevice)
	protected.DELETE("/devices/:id", s.handleDeleteDevice)

	api := protected.Group("/api")
	api.GET("/devices", s.handleListDevices)
	api.POST("/devices", s.handleCreateDevice)
	api.POST("/devices/test-snmp", s.handleTestSNMP)
	api.DELETE("/devices/:id", s.handleDeleteDevice)
	protected.GET("/macs", s.handleListMacs)
	protected.GET("/alert-destinations", s.handleListAlertDestinations)
	protected.POST("/alert-destinations", s.handleCreateAlertDestination)
	protected.PATCH("/alert-destinations/:id", s.handleUpdateAlertDestination)
	protected.DELETE("/alert-destinations/:id", s.handleDeleteAlertDestination)

	protected.GET("/alerts", s.handleListAlerts)
	if s.cfg.Metrics.Enabled {
		if s.cfg.Metrics.Public {
			engine.GET("/metrics", gin.WrapH(promhttp.Handler()))
		} else {
			protected.GET("/metrics", gin.WrapH(promhttp.Handler()))
		}
	}

	engine.GET("/discovery", s.authRequired(), s.handleDiscovery)

	srv := &http.Server{
		Addr:    s.cfg.HTTP.Addr,
		Handler: engine,
	}

	go func() {
		<-ctx.Done()
		ctxShutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctxShutdown)
	}()

	log.Info().Str("addr", s.cfg.HTTP.Addr).Msg("http server listening")
	var err error
	if s.cfg.HTTP.EnableTLS {
		err = srv.ListenAndServeTLS(s.cfg.HTTP.CertFile, s.cfg.HTTP.KeyFile)
	} else {
		err = srv.ListenAndServe()
	}
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func (s *HTTPServer) handleListTenants(c *gin.Context) {
	user, ok := s.getAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	tenants, err := s.store.GetUserTenants(c.Request.Context(), user.ID)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"tenants": tenants})
}

func (s *HTTPServer) handleListDevices(c *gin.Context) {
	filter := store.DeviceFilter{Site: c.Query("site")}
	if enabledStr := c.Query("enabled"); enabledStr != "" {
		if val, err := strconv.ParseBool(enabledStr); err == nil {
			filter.Enabled = &val
		}
	}
	tenantID := s.getTenantID(c)
	devices, err := s.store.ListDevices(c.Request.Context(), tenantID, filter)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"devices": devices})
}

func (s *HTTPServer) handleGetDevice(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	tenantID := s.getTenantID(c)
	device, err := s.store.GetDevice(c.Request.Context(), tenantID, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, device)
}

func (s *HTTPServer) handleDeleteDevice(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	tenantID := s.getTenantID(c)
	if err := s.store.DeleteDevice(c.Request.Context(), tenantID, id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		s.respondErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (s *HTTPServer) handleDeviceInterfaces(c *gin.Context) {
	deviceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	// Interface states query check (omitted for brevity, assuming it doesn't filter by OrgID/TenantID directly or uses deviceID which is unique enough if checked against tenant)
	// However, GetInterfaceStates signature is likely (ctx, deviceID). Let's check.
	// Actually, previous code passed orgID: s.store.GetInterfaceStates(c.Request.Context(), orgID, deviceID)
	// We need to update GetInterfaceStates signature too if it takes orgID!
	// Assuming I update GetInterfaceStates to take tenantID or just rely on deviceID belonging to tenant.
	// For now, let's pass tenantID. I need to update interfaces.go later.
	tenantID := s.getTenantID(c)
	statesMap, err := s.store.GetInterfaceStates(c.Request.Context(), tenantID, deviceID)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	list := make([]store.InterfaceState, 0, len(statesMap))
	for _, st := range statesMap {
		list = append(list, st)
	}
	sort.Slice(list, func(i, j int) bool { return list[i].IfIndex < list[j].IfIndex })
	c.JSON(http.StatusOK, gin.H{"interfaces": list})
}

func (s *HTTPServer) handleDeviceMacs(c *gin.Context) {
	deviceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	filter := store.MACFilter{DeviceID: &deviceID}
	if vlanStr := c.Query("vlan"); vlanStr != "" {
		if vlan, err := strconv.Atoi(vlanStr); err == nil {
			filter.VLAN = &vlan
		}
	}
	filter.MACLike = c.Query("mac")
	tenantID := s.getTenantID(c)
	macs, err := s.store.GetMacEntries(c.Request.Context(), tenantID, filter)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	// Simplified: GetMacEntries now returns joined fields.
	c.JSON(http.StatusOK, gin.H{"mac_entries": macs})
}

func (s *HTTPServer) handleListMacs(c *gin.Context) {
	filter := store.MACFilter{MACLike: c.Query("mac")}
	if deviceIDStr := c.Query("device_id"); deviceIDStr != "" {
		if deviceID, err := strconv.ParseInt(deviceIDStr, 10, 64); err == nil {
			filter.DeviceID = &deviceID
		}
	}
	if vlanStr := c.Query("vlan"); vlanStr != "" {
		if vlan, err := strconv.Atoi(vlanStr); err == nil {
			filter.VLAN = &vlan
		}
	}
	tenantID := s.getTenantID(c)
	macs, err := s.store.GetMacEntries(c.Request.Context(), tenantID, filter)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	// Simplified: GetMacEntries now returns joined fields.
	c.JSON(http.StatusOK, gin.H{"mac_entries": macs})
}

func (s *HTTPServer) handleListAlerts(c *gin.Context) {
	filter := store.AlertFilter{}
	if deviceIDStr := c.Query("device_id"); deviceIDStr != "" {
		if deviceID, err := strconv.ParseInt(deviceIDStr, 10, 64); err == nil {
			filter.DeviceID = &deviceID
		}
	}
	if active := c.Query("active"); active != "" {
		if val, err := strconv.ParseBool(active); err == nil {
			filter.Active = &val
		}
	}
	tenantID := s.getTenantID(c)
	alerts, err := s.store.ListAlerts(c.Request.Context(), tenantID, filter)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"alerts": alerts})
}

func (s *HTTPServer) handleDiscovery(c *gin.Context) {
	tenantID := s.getTenantID(c)
	records, err := s.store.ListDiscoveries(c.Request.Context(), tenantID)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"discoveries": records})
}

func (s *HTTPServer) handleSystemStatus(c *gin.Context) {
	status := gin.H{
		"status":          "ok",
		"time":            time.Now().UTC(),
		"metrics_enabled": s.cfg.Metrics.Enabled,
		"metrics_public":  s.cfg.Metrics.Public,
		"demo_mode":       s.cfg.DemoMode,
	}

	if err := s.store.Ping(c.Request.Context()); err != nil {
		log.Error().Err(err).Msg("system status ping failed")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "degraded",
			"error":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, status)
}

func (s *HTTPServer) respondErr(c *gin.Context, err error) {
	log.Warn().Err(err).Msg("api error")
	c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
}

func (s *HTTPServer) getTenantID(c *gin.Context) string {
	if t, ok := s.getAuthTenant(c); ok {
		return t.ID
	}
	// Verify if this is correct: if no tenant in context (e.g. unprotected route, but we protected them), return empty?
	// The authRequired middleware guarantees tenant is present.
	// For public routes, this shouldn't be called.
	return ""
}
