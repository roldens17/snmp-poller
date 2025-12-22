package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// GetInterfaceStates returns current state keyed by ifIndex.
func (s *Store) GetInterfaceStates(ctx context.Context, orgID int64, deviceID int64) (map[int]InterfaceState, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT i.if_index, COALESCE(i.if_name, ''), COALESCE(i.if_descr, ''), COALESCE(i.admin_status, 'unknown'), COALESCE(i.oper_status, 'unknown'), COALESCE(i.speed, 0), 
			COALESCE(c.in_octets, 0), COALESCE(c.out_octets, 0), COALESCE(c.in_errors, 0), COALESCE(c.out_errors, 0),
			i.status_changed_at, i.updated_at
		FROM interfaces i
		JOIN devices d ON i.device_id = d.id
		LEFT JOIN (
			SELECT DISTINCT ON (if_index) if_index, in_octets, out_octets, in_errors, out_errors
			FROM interface_counters
			WHERE device_id = $1
			ORDER BY if_index, collected_at DESC
		) c ON i.if_index = c.if_index
		WHERE i.device_id = $1 AND d.org_id = $2`, deviceID, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	states := make(map[int]InterfaceState)
	for rows.Next() {
		var st InterfaceState
		st.DeviceID = deviceID
		if err := rows.Scan(&st.IfIndex, &st.IfName, &st.IfDescr, &st.AdminStatus, &st.OperStatus, &st.Speed,
			&st.InOctets, &st.OutOctets, &st.InErrors, &st.OutErrors,
			&st.StatusChangedAt, &st.UpdatedAt); err != nil {
			return nil, err
		}
		states[st.IfIndex] = st
	}
	return states, rows.Err()
}

// UpsertInterfaces stores the latest interface state for a device.
func (s *Store) UpsertInterfaces(ctx context.Context, deviceID int64, interfaces []InterfaceState) error {
	if len(interfaces) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for _, inf := range interfaces {
		batch.Queue(`INSERT INTO interfaces (device_id, if_index, if_name, if_descr, admin_status, oper_status, speed, status_changed_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
			ON CONFLICT (device_id, if_index)
			DO UPDATE SET if_name=EXCLUDED.if_name,
				if_descr=EXCLUDED.if_descr,
				admin_status=EXCLUDED.admin_status,
				oper_status=EXCLUDED.oper_status,
				speed=EXCLUDED.speed,
				status_changed_at=EXCLUDED.status_changed_at,
				updated_at=EXCLUDED.updated_at`,
			deviceID, inf.IfIndex, inf.IfName, inf.IfDescr, inf.AdminStatus, inf.OperStatus, inf.Speed, inf.StatusChangedAt.UTC(), inf.UpdatedAt.UTC())
	}

	res := s.pool.SendBatch(ctx, batch)
	defer res.Close()
	for range interfaces {
		if _, err := res.Exec(); err != nil {
			return err
		}
	}
	return res.Close()
}

// InsertInterfaceCounters appends new counter samples.
func (s *Store) InsertInterfaceCounters(ctx context.Context, counters []InterfaceCounters) error {
	if len(counters) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, c := range counters {
		batch.Queue(`INSERT INTO interface_counters (device_id, if_index, in_octets, out_octets, in_errors, out_errors, collected_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7)
			ON CONFLICT (device_id, if_index, collected_at)
			DO UPDATE SET in_octets=EXCLUDED.in_octets,
				out_octets=EXCLUDED.out_octets,
				in_errors=EXCLUDED.in_errors,
				out_errors=EXCLUDED.out_errors`, c.DeviceID, c.IfIndex, c.InOctets, c.OutOctets, c.InErrors, c.OutErrors, c.CollectedAt.UTC())
	}
	res := s.pool.SendBatch(ctx, batch)
	defer res.Close()
	for range counters {
		if _, err := res.Exec(); err != nil {
			return err
		}
	}
	return res.Close()
}

// PruneInterfaces removes interfaces not present in the provided set.
func (s *Store) PruneInterfaces(ctx context.Context, deviceID int64, keep []int) error {
	if len(keep) == 0 {
		_, err := s.pool.Exec(ctx, `DELETE FROM interfaces WHERE device_id=$1`, deviceID)
		return err
	}

	int32Keep := make([]int32, 0, len(keep))
	for _, idx := range keep {
		int32Keep = append(int32Keep, int32(idx))
	}
	_, err := s.pool.Exec(ctx, `DELETE FROM interfaces WHERE device_id=$1 AND NOT (if_index = ANY($2))`, deviceID, int32Keep)
	return err
}

// LastInterfaceCounters returns the latest counters snapshot per interface.
func (s *Store) LastInterfaceCounters(ctx context.Context, orgID int64, deviceID int64, ifIndex int) (*InterfaceCounters, error) {
	row := s.pool.QueryRow(ctx, `SELECT device_id, if_index, COALESCE(in_octets, 0), COALESCE(out_octets, 0), COALESCE(in_errors, 0), COALESCE(out_errors, 0), collected_at
		FROM interface_counters i
		JOIN devices d ON i.device_id = d.id
		WHERE i.device_id=$1 AND i.if_index=$2 AND d.org_id=$3
		ORDER BY collected_at DESC LIMIT 1`, deviceID, ifIndex, orgID)
	var c InterfaceCounters
	if err := row.Scan(&c.DeviceID, &c.IfIndex, &c.InOctets, &c.OutOctets, &c.InErrors, &c.OutErrors, &c.CollectedAt); err != nil {
		return nil, err
	}
	return &c, nil
}

// UpdateInterfaceStatusChanged updates the status change timestamp on change.
func (s *Store) UpdateInterfaceStatusChanged(ctx context.Context, deviceID int64, ifIndex int, ts time.Time) error {
	_, err := s.pool.Exec(ctx, `UPDATE interfaces SET status_changed_at=$1 WHERE device_id=$2 AND if_index=$3`, ts.UTC(), deviceID, ifIndex)
	return err
}

// LatestInterfaceCounters returns the most recent counters per interface for a device.
func (s *Store) LatestInterfaceCounters(ctx context.Context, orgID int64, deviceID int64) (map[int]InterfaceCounters, error) {
	rows, err := s.pool.Query(ctx, `SELECT DISTINCT ON (i.if_index) i.if_index, COALESCE(i.in_octets, 0), COALESCE(i.out_octets, 0), COALESCE(i.in_errors, 0), COALESCE(i.out_errors, 0), i.collected_at
		FROM interface_counters i
		JOIN devices d ON i.device_id = d.id
		WHERE i.device_id=$1 AND d.org_id=$2
		ORDER BY i.if_index, i.collected_at DESC`, deviceID, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[int]InterfaceCounters)
	for rows.Next() {
		var c InterfaceCounters
		c.DeviceID = deviceID
		if err := rows.Scan(&c.IfIndex, &c.InOctets, &c.OutOctets, &c.InErrors, &c.OutErrors, &c.CollectedAt); err != nil {
			return nil, err
		}
		result[c.IfIndex] = c
	}
	return result, rows.Err()
}
