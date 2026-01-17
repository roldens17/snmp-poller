package store

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/fresatu/snmp-poller/internal/config"
	"github.com/fresatu/snmp-poller/migrations"
)

// Store wraps a pgx pool + helper methods.
type Store struct {
	pool *pgxpool.Pool
}

// New creates a pgx pool for the provided config.
func New(ctx context.Context, cfg config.PostgresConfig) (*Store, error) {
	if cfg.DSN == "" {
		return nil, fmt.Errorf("postgres dsn is empty")
	}

	poolCfg, err := pgxpool.ParseConfig(cfg.DSN)
	if err != nil {
		return nil, err
	}
	if cfg.MaxConns > 0 {
		poolCfg.MaxConns = cfg.MaxConns
	}
	if poolCfg.ConnConfig.RuntimeParams == nil {
		poolCfg.ConnConfig.RuntimeParams = map[string]string{}
	}
	poolCfg.ConnConfig.RuntimeParams["timezone"] = "UTC"

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, err
	}

	return &Store{pool: pool}, nil
}

// Close releases database resources.
func (s *Store) Close() {
	if s == nil || s.pool == nil {
		return
	}
	s.pool.Close()
}

// Ping verifies database connectivity.
func (s *Store) Ping(ctx context.Context) error {
	if s == nil || s.pool == nil {
		return fmt.Errorf("store not initialized")
	}
	return s.pool.Ping(ctx)
}

// RunMigrations applies embedded SQL migrations sequentially.
func (s *Store) RunMigrations(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
	)`)
	if err != nil {
		return fmt.Errorf("init schema_migrations: %w", err)
	}

	entries, err := migrations.Files.ReadDir(".")
	if err != nil {
		return err
	}

	type migration struct {
		Version string
		SQL     string
	}

	migs := make([]migration, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if !strings.HasSuffix(name, ".up.sql") {
			continue
		}
		data, readErr := migrations.Files.ReadFile(name)
		if readErr != nil {
			return readErr
		}
		version := strings.TrimSuffix(name, ".up.sql")
		migs = append(migs, migration{Version: version, SQL: string(data)})
	}

	sort.Slice(migs, func(i, j int) bool {
		return migs[i].Version < migs[j].Version
	})

	for _, m := range migs {
		var applied bool
		err = s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=$1)`, m.Version).Scan(&applied)
		if err != nil {
			return err
		}
		if applied {
			continue
		}

		log.Info().Str("migration", m.Version).Msg("applying migration")
		tx, beginErr := s.pool.Begin(ctx)
		if beginErr != nil {
			return fmt.Errorf("begin migration %s: %w", m.Version, beginErr)
		}

		if _, err = tx.Exec(ctx, m.SQL); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("apply migration %s: %w", m.Version, err)
		}
		if _, err = tx.Exec(ctx, `INSERT INTO schema_migrations(version, applied_at) VALUES($1, $2)`, m.Version, time.Now().UTC()); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("record migration %s: %w", m.Version, err)
		}
		if commitErr := tx.Commit(ctx); commitErr != nil {
			return fmt.Errorf("commit migration %s: %w", m.Version, commitErr)
		}
	}

	return nil
}

// Pool exposes the underlying pgx pool for advanced queries.
func (s *Store) Pool() *pgxpool.Pool {
	return s.pool
}
