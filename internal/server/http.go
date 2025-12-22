package server

import (
	"context"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog/log"

	"github.com/fresatu/snmp-poller/internal/config"
	"github.com/fresatu/snmp-poller/internal/store"
)

const defaultOrgID = 1

// HTTPServer exposes REST + metrics endpoints.
type HTTPServer struct {
	cfg   *config.Config
	store *store.Store
}

// NewHTTPServer configures the API server.
func NewHTTPServer(cfg *config.Config, db *store.Store) *HTTPServer {
	return &HTTPServer{cfg: cfg, store: db}
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

	health := func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "time": time.Now().UTC()})
	}
	engine.GET("/healthz", health)
	engine.GET("/health", health)
	engine.GET("/devices", s.handleListDevices)
	engine.GET("/devices/:id", s.handleGetDevice)
	engine.GET("/devices/:id/interfaces", s.handleDeviceInterfaces)
	engine.GET("/devices/:id/macs", s.handleDeviceMacs)
	engine.GET("/macs", s.handleListMacs)
	engine.GET("/alerts", s.handleListAlerts)
	engine.GET("/discovery", s.handleDiscovery)
	if s.cfg.Metrics.Enabled {
		engine.GET("/metrics", gin.WrapH(promhttp.Handler()))
	}

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

func (s *HTTPServer) handleListDevices(c *gin.Context) {
	filter := store.DeviceFilter{Site: c.Query("site")}
	if enabledStr := c.Query("enabled"); enabledStr != "" {
		if val, err := strconv.ParseBool(enabledStr); err == nil {
			filter.Enabled = &val
		}
	}
	orgID := s.getOrgID(c)
	devices, err := s.store.ListDevices(c.Request.Context(), orgID, filter)
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
	orgID := s.getOrgID(c)
	device, err := s.store.GetDevice(c.Request.Context(), orgID, id)
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

func (s *HTTPServer) handleDeviceInterfaces(c *gin.Context) {
	deviceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	orgID := s.getOrgID(c)
	statesMap, err := s.store.GetInterfaceStates(c.Request.Context(), orgID, deviceID)
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
	orgID := s.getOrgID(c)
	macs, err := s.store.GetMacEntries(c.Request.Context(), orgID, filter)
	if err != nil {
		s.respondErr(c, err)
		return
	}
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
	orgID := s.getOrgID(c)
	macs, err := s.store.GetMacEntries(c.Request.Context(), orgID, filter)
	if err != nil {
		s.respondErr(c, err)
		return
	}
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
	orgID := s.getOrgID(c)
	alerts, err := s.store.ListAlerts(c.Request.Context(), orgID, filter)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"alerts": alerts})
}

func (s *HTTPServer) handleDiscovery(c *gin.Context) {
	orgID := s.getOrgID(c)
	records, err := s.store.ListDiscoveries(c.Request.Context(), orgID)
	if err != nil {
		s.respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"discoveries": records})
}

func (s *HTTPServer) respondErr(c *gin.Context, err error) {
	log.Warn().Err(err).Msg("api error")
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}

func (s *HTTPServer) getOrgID(c *gin.Context) int64 {
	if orgIDStr := c.GetHeader("X-Org-ID"); orgIDStr != "" {
		if id, err := strconv.ParseInt(orgIDStr, 10, 64); err == nil {
			return id
		}
	}
	return defaultOrgID
}
