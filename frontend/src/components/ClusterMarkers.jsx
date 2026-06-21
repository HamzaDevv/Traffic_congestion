import { CircleMarker, Popup } from 'react-leaflet'
import { useMemo } from 'react'

// Design system risk colors (dark mode hex values)
function severityColor(score) {
  if (score < 0.25) return '#10B981' // risk-low
  if (score < 0.5)  return '#F59E0B' // risk-moderate
  if (score < 0.75) return '#EF4444' // risk-high
  return '#DC2626' // risk-critical
}

function severityLabel(score) {
  if (score < 0.25) return 'Low'
  if (score < 0.5)  return 'Moderate'
  if (score < 0.75) return 'High'
  return 'Critical'
}

export default function ClusterMarkers({ reports, cascadeStage = 4 }) {
  // Limit rendering for performance
  const visible = useMemo(() => {
    return reports.slice(0, 2500)
  }, [reports])

  return (
    <>
      {visible.map((r, i) => {
        let color = '#0C73EB' // Default raw color (accent-blue)
        let radius = 3
        let opacity = 0.5

        if (cascadeStage === 1) {
          color = '#10B981' // Validated (risk-low)
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
                <div style={{ fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>
                  {r.vehicle_type}
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
                <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
                  {cascadeStage >= 2 ? (
                    <div>Severity: <strong style={{ color }}>{(r.severity_score * 100).toFixed(0)}%</strong></div>
                  ) : (
                    <div>Status: <strong style={{ color }}>{cascadeStage === 1 ? 'Validated' : 'Raw Report'}</strong></div>
                  )}
                  <div>Station: <strong>{r.police_station || 'Unknown'}</strong></div>
                  <div>Hour: <strong>{r.hour}:00</strong></div>
                  {r.junction_name && r.junction_name !== 'No Junction' && (
                    <div style={{ color: '#F59E0B', marginTop: '4px', fontSize: '11px', fontWeight: '500' }}>
                      Junction violation
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
