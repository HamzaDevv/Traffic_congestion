import { CircleMarker, Popup } from 'react-leaflet'
import { useMemo } from 'react'

function severityColor(score) {
  if (score < 0.25) return '#00e676'
  if (score < 0.5)  return '#ffea00'
  if (score < 0.75) return '#ff9100'
  return '#ff1744'
}

function severityLabel(score) {
  if (score < 0.25) return 'Low'
  if (score < 0.5)  return 'Moderate'
  if (score < 0.75) return 'High'
  return 'Critical'
}

function vehicleIcon(vtype) {
  const t = (vtype || '').toUpperCase()
  if (t.includes('SCOOTER') || t.includes('MOTOR CYCLE') || t.includes('MOPED')) return '🛵'
  if (t.includes('CAR'))     return '🚗'
  if (t.includes('AUTO'))    return '🛺'
  if (t.includes('BUS') || t.includes('TANKER') || t.includes('TRUCK') || t.includes('LORRY')) return '🚛'
  if (t.includes('VAN'))     return '🚐'
  return '🚘'
}

export default function ClusterMarkers({ reports, cascadeStage = 4 }) {
  // Limit rendering for performance
  const visible = useMemo(() => {
    return reports.slice(0, 2500)
  }, [reports])

  return (
    <>
      {visible.map((r, i) => {
        let color = '#3b82f6' // Default raw color
        let radius = 3
        let opacity = 0.5

        if (cascadeStage === 1) {
          color = '#00e676' // Validated
          opacity = 0.6
        } else if (cascadeStage >= 2) {
          color = severityColor(r.severity_score)
          radius = 3 + r.severity_score * 5
          opacity = 0.9
        }

        return (
          <CircleMarker
            key={r.id || i}
            center={[r.latitude, r.longitude]}
            radius={radius}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: opacity - 0.15,
              weight: 0.5,
              opacity: opacity,
            }}
          >
            <Popup>
              <div style={{ minWidth: '180px', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                  {vehicleIcon(r.vehicle_type)} {r.vehicle_type}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: color,
                  }} />
                  <span style={{ fontSize: '14px', fontWeight: '600', color }}>
                    {severityLabel(r.severity_score)} Impact
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>
                  {cascadeStage >= 2 ? (
                    <div>Severity: <strong style={{ color }}>{(r.severity_score * 100).toFixed(0)}%</strong></div>
                  ) : (
                    <div>Status: <strong style={{ color }}>{cascadeStage === 1 ? 'Validated' : 'Raw Report'}</strong></div>
                  )}
                  <div>Station: <strong style={{ color: '#e2e8f0' }}>{r.police_station || 'Unknown'}</strong></div>
                  <div>Hour: <strong style={{ color: '#e2e8f0' }}>{r.hour}:00</strong></div>
                  {r.junction_name && r.junction_name !== 'No Junction' && (
                    <div style={{ color: '#ff9100', marginTop: '4px', fontSize: '11px' }}>
                      ⚠ Junction violation
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
