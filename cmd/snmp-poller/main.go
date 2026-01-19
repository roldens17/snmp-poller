package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/fresatu/snmp-poller/internal/config"
	"github.com/fresatu/snmp-poller/internal/poller"
	"github.com/fresatu/snmp-poller/internal/server"
	"github.com/fresatu/snmp-poller/internal/store"
)

func main() {
	// Root context with signal handling
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Load config (config.yaml is optional; env overrides supported)
	cfgPath := os.Getenv("CONFIG_FILE")
	if cfgPath == "" {
		cfgPath = "config.yaml"
	}

	cfg, err := config.Load(cfgPath)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	// Connect to Postgres
	db, err := store.New(ctx, cfg.Postgres)
	if err != nil {
	log.Fatal().Err(err).Msg("failed to connect to postgres")
	}		
	defer db.Close()

	// Apply database migrations before starting services.
	if err := db.RunMigrations(ctx); err != nil {
		log.Fatal().Err(err).Msg("database migrations failed")
	}

	// Start poller
	pollerSvc := poller.NewService(cfg, db)
	go pollerSvc.Run(ctx)

	// Start HTTP server
	httpSrv := server.NewHTTPServer(cfg, db)
	go func() {
		if err := httpSrv.Run(ctx); err != nil {
			log.Error().Err(err).Msg("http server stopped")
			stop()
		}
	}()

	log.Info().Msg("snmp-poller started")

	// Wait for shutdown
	<-ctx.Done()
	log.Info().Msg("shutting down snmp-poller")

	// Small grace period
	time.Sleep(2 * time.Second)
}
