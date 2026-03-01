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

	// V1.1 inferred links: devices sharing learned MACs are likely connected in L2 path.
	edgeRows, err := s.pool.Query(ctx, `
		SELECT
		  LEAST(m1.device_id, m2.device_id) AS d1,
		  GREATEST(m1.device_id, m2.device_id) AS d2,
		  COUNT(*) AS weight
		FROM mac_entries m1
		JOIN mac_entries m2
		  ON m1.tenant_id = m2.tenant_id
		 AND m1.mac = m2.mac
		 AND m1.device_id < m2.device_id
		WHERE m1.tenant_id=$1::uuid
		  AND m1.last_seen > now() - interval '24 hours'
		  AND m2.last_seen > now() - interval '24 hours'
		GROUP BY LEAST(m1.device_id, m2.device_id), GREATEST(m1.device_id, m2.device_id)
		HAVING COUNT(*) >= 2
		ORDER BY weight DESC
		LIMIT 300
	`, tenantID)
	if err != nil {
		return nil, nil, err
	}
	defer edgeRows.Close()

	idToNode := map[int64]string{}
	for _, n := range nodes {
		idToNode[n.DeviceID] = n.ID
	}

	edges := []TopologyEdge{}
	for edgeRows.Next() {
		var d1, d2 int64
		var weight int
		if err := edgeRows.Scan(&d1, &d2, &weight); err != nil {
			return nil, nil, err
		}
		src, ok1 := idToNode[d1]
		tgt, ok2 := idToNode[d2]
		if !ok1 || !ok2 || src == "" || tgt == "" {
			continue
		}
		edges = append(edges, TopologyEdge{
			ID:     src + "->" + tgt,
			Source: src,
			Target: tgt,
			Type:   "inferred",
		})
	}
	if err := edgeRows.Err(); err != nil {
		return nil, nil, err
	}

	return nodes, edges, nil
}
