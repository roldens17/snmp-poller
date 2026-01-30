package store

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// CreateDeviceTest stores a short-lived SNMP validation token.
func (s *Store) CreateDeviceTest(ctx context.Context, test *DeviceTest) error {
	const q = `INSERT INTO device_tests (tenant_id, ip, snmp_fingerprint_hash, test_token, expires_at)
		VALUES ($1,$2,$3,$4,$5)
		RETURNING id, created_at`
	return s.pool.QueryRow(ctx, q, test.TenantID, test.IP, test.SNMPFingerprintHash, test.TestToken, test.ExpiresAt).
		Scan(&test.ID, &test.CreatedAt)
}

// ConsumeDeviceTest deletes and returns a matching device test if still valid.
func (s *Store) ConsumeDeviceTest(ctx context.Context, tenantID, ip, fingerprint, token string) (*DeviceTest, error) {
	const q = `DELETE FROM device_tests
		WHERE tenant_id=$1 AND ip=$2 AND snmp_fingerprint_hash=$3 AND test_token=$4 AND expires_at > now()
		RETURNING id, tenant_id, ip, snmp_fingerprint_hash, test_token, expires_at, created_at`
	var test DeviceTest
	if err := s.pool.QueryRow(ctx, q, tenantID, ip, fingerprint, token).
		Scan(&test.ID, &test.TenantID, &test.IP, &test.SNMPFingerprintHash, &test.TestToken, &test.ExpiresAt, &test.CreatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, err
		}
		return nil, err
	}
	return &test, nil
}
