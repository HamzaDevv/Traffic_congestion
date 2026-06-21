import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import HeatmapLayer from './HeatmapLayer'
import ClusterMarkers from './ClusterMarkers'

// ── Fly-to helper ──
function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lon], 15, { duration: 1.2 })
    }
  }, [target, map])
  return null
}

function getSeverityColor(score) {
  if (score < 0.25) return '#00e676'
  if (score < 0.5)  return '#ffea00'
  if (score < 0.75) return '#ff9100'
  return '#ff1744'
}

function getRiskLabel(score) {
  if (score < 0.25) return { label: 'Low Risk', cls: 'severity-low' }
  if (score < 0.5)  return { label: 'Moderate Risk', cls: 'severity-mod' }
  if (score < 0.75) return { label: 'High Risk', cls: 'severity-high' }
  return { label: 'CRITICAL', cls: 'severity-crit' }
}

export default function MapArea({
  reports,
  heatmap,
  clusters,
  showHeatmap,
  showMarkers,
  showClusters,
  flyToTarget,
  simulatePin,
  cascadeStage,
}) {
  return (
    <MapContainer
      center={[12.97, 77.59]}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      {/* Dark CartoDB tiles */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />

      {/* Fly-to on cluster click */}
      <FlyTo target={flyToTarget} />

      {/* ── Layer 1: Heatmap ── */}
      {showHeatmap && <HeatmapLayer data={heatmap} />}

      {/* ── Layer 2: Individual violation markers ── */}
      {showMarkers && <ClusterMarkers reports={reports} cascadeStage={cascadeStage} />}

      {/* ── Layer 3: DBSCAN Hotspot Zones ── */}
      {showClusters && clusters.map((c, i) => {
        const color = getSeverityColor(c.avg_severity)
        const risk = getRiskLabel(c.avg_severity)
        const radiusPx = Math.max(25, Math.min(60, Math.sqrt(c.count) * 6))

        return (
          <CircleMarker
            key={c.cluster_id}
            center={[c.latitude, c.longitude]}
            radius={radiusPx}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 0.12,
              weight: 2,
              opacity: 0.7,
              dashArray: '6 4',
            }}
          >
            <Popup>
              <div style={{ minWidth: '200px', fontFamily: 'Inter, sans-serif' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: '8px'
                }}>
                  <span style={{ fontWeight: '700', fontSize: '15px', color: '#e2e8f0' }}>
                    Hotspot #{i + 1}
                  </span>
                  <span style={{
                    fontSize: '11px', fontWeight: '600', padding: '2px 8px',
                    borderRadius: '20px', color,
                    border: `1px solid ${color}40`,
                    background: `${color}18`,
                  }}>
                    {risk.label}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.8' }}>
                  <div>🚨 <strong style={{ color: '#e2e8f0' }}>{c.count}</strong> violations</div>
                  <div>📊 Avg severity: <strong style={{ color }}>{(c.avg_severity * 100).toFixed(0)}%</strong></div>
                  <div>📍 Station: <strong style={{ color: '#e2e8f0' }}>{c.top_station}</strong></div>
                  <div>📏 Radius: <strong style={{ color: '#e2e8f0' }}>{c.radius_m.toFixed(0)}m</strong></div>
                </div>
                <div style={{
                  marginTop: '8px', padding: '6px 8px',
                  background: `${color}18`, borderRadius: '6px',
                  fontSize: '11px', color, fontWeight: '500',
                  textAlign: 'center', letterSpacing: '0.5px',
                }}>
                  🚔 DISPATCH RECOMMENDED
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {/* ── Simulate pin ── */}
      {simulatePin && (
        <CircleMarker
          center={[simulatePin.lat, simulatePin.lon]}
          radius={12}
          pathOptions={{
            color: '#00e5ff',
            fillColor: '#00e5ff',
            fillOpacity: 0.3,
            weight: 2,
          }}
        >
          <Popup>
            <div style={{ fontSize: '13px', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
              <div style={{ fontWeight: '600', marginBottom: '4px', color: '#00e5ff' }}>
                Simulated Report
              </div>
              <div>Severity: {(simulatePin.severity * 100).toFixed(0)}%</div>
              <div style={{ color: simulatePin.approved ? '#00e676' : '#ff1744', marginTop: '4px', fontWeight: '600' }}>
                {simulatePin.approved ? '✓ APPROVED' : '✗ REJECTED'}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      )}
    </MapContainer>
  )
}
