package store

import "context"

type TopologyNode struct {
	ID           string `json:"id"`
	DeviceID     int64  `json:"device_id"`
	Label        string `json:"label"`
	IP           string `json:"ip"`
	Status       string `json:"status"`
	ActiveAlerts int    `json:"active_alerts"`
}

type TopologyEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Type   string `json:"type"`
}

func (s *Store) BuildTopology(ctx context.Context, tenantID string) ([]TopologyNode, []TopologyEdge, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT d.id, COALESCE(d.hostname,''), COALESCE(d.mgmt_ip::text,''), COALESCE(d.status,''),
		  COALESCE((SELECT count(*) FROM alerts a WHERE a.tenant_id=d.tenant_id AND a.device_id=d.id AND a.status='active'),0) AS active_alerts
		FROM devices d
		WHERE d.tenant_id=$1::uuid
		ORDER BY d.hostname
	`, tenantID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	nodes := []TopologyNode{}
	for rows.Next() {
		var n TopologyNode
		if err := rows.Scan(&n.DeviceID, &n.Label, &n.IP, &n.Status, &n.ActiveAlerts); err != nil {
			return nil, nil, err
		}
		n.ID = n.IP
		if n.ID == "" {
			n.ID = n.Label
		}
		if n.ID == "" {
			n.ID = "device"
		}
		nodes = append(nodes, n)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	// V1: no inferred physical links yet.
	edges := []TopologyEdge{}
	return nodes, edges, nil
}
