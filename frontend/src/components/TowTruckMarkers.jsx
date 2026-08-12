import React, { useEffect } from 'react'
import { Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Truck } from 'lucide-react'

/**
 * Creates custom Leaflet DivIcon for Tow Trucks & Patrol Units
 */
function createTowTruckIcon(unit) {
  const isHeavy = unit.unit_type === 'HEAVY_TOW_TRUCK'
  const isArrived = unit.status === 'ARRIVED' || unit.progress >= 1

  const bgGradient = isArrived
    ? 'linear-gradient(135deg, #10B981, #059669)'
    : isHeavy
    ? 'linear-gradient(135deg, #F59E0B, #D97706)'
    : 'linear-gradient(135deg, #3B82F6, #2563EB)'

  const iconSvg = isHeavy
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 9 7 14"/><path d="M18.5 17.5 14 4h-3l-2.5 6"/></svg>`

  const html = `
    <div style="position: relative; display: flex; align-items: center; justify-content: center;">
      <!-- Siren pulse ring -->
      ${!isArrived ? `
        <div style="
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          background: ${isHeavy ? 'rgba(245, 158, 11, 0.35)' : 'rgba(59, 130, 246, 0.35)'};
          animation: towTruckPulse 1.2s infinite ease-in-out;
          pointer-events: none;
        "></div>
      ` : ''}

      <!-- Main Unit Badge -->
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: ${bgGradient};
        border: 2px solid #ffffff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 15px ${isHeavy ? 'rgba(245, 158, 11, 0.6)' : 'rgba(59, 130, 246, 0.6)'};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s ease;
      ">
        ${iconSvg}
      </div>

      <!-- Unit ID pill -->
      <div style="
        position: absolute;
        bottom: -18px;
        white-space: nowrap;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid ${isArrived ? '#10B981' : isHeavy ? '#f59e0b' : '#3b82f6'};
        font-family: monospace;
        font-size: 9px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 4px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
      ">
        ${unit.unit_id}
      </div>
    </div>
  `

  return L.divIcon({
    html,
    className: 'custom-tow-truck-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22],
  })
}

export default function TowTruckMarkers({ activeTrucks = [] }) {
  const map = useMap()

  useEffect(() => {
    // Inject CSS keyframe for siren pulse if not present
    if (!document.getElementById('tow-truck-pulse-style')) {
      const style = document.createElement('style')
      style.id = 'tow-truck-pulse-style'
      style.innerHTML = `
        @keyframes towTruckPulse {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.5); opacity: 0.2; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }
      `
      document.head.appendChild(style)
    }
  }, [])

  if (!activeTrucks || activeTrucks.length === 0) return null

  return (
    <>
      {activeTrucks.map((truck) => {
        const isArrived = truck.status === 'ARRIVED' || truck.progress >= 1
        const routePath = truck.path_coords || []

        return (
          <React.Fragment key={truck.id || truck.unit_id}>
            {/* Dijkstra Green Corridor Route Polyline */}
            {routePath.length > 1 && (
              <>
                {/* Glow Outer Polyline */}
                <Polyline
                  positions={routePath}
                  pathOptions={{
                    color: truck.unit_type === 'HEAVY_TOW_TRUCK' ? '#f59e0b' : '#38bdf8',
                    weight: 8,
                    opacity: 0.35,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
                {/* Core Dashed Polyline */}
                <Polyline
                  positions={routePath}
                  pathOptions={{
                    color: isArrived ? '#10b981' : '#ffffff',
                    weight: 3,
                    opacity: 0.9,
                    dashArray: isArrived ? 'none' : '8 6',
                    lineCap: 'round',
                  }}
                />
              </>
            )}

            {/* Tow Truck Animated Marker */}
            <Marker
              position={[truck.currentPos.lat, truck.currentPos.lon]}
              icon={createTowTruckIcon(truck)}
            >
              <Popup>
                <div style={{ minWidth: '220px', fontFamily: 'Inter, sans-serif' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    paddingBottom: '6px',
                    borderBottom: '1px solid #334155'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Truck size={16} color={truck.unit_type === 'HEAVY_TOW_TRUCK' ? '#f59e0b' : '#38bdf8'} />
                      <strong style={{ fontSize: '13px', color: '#f8fafc' }}>
                        {truck.unit_id}
                      </strong>
                    </div>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: isArrived ? '#10b98120' : '#f59e0b20',
                      color: isArrived ? '#10b981' : '#f59e0b',
                      border: `1px solid ${isArrived ? '#10b98140' : '#f59e0b40'}`,
                      textTransform: 'uppercase'
                    }}>
                      {truck.status || (isArrived ? 'ON SCENE' : 'EN ROUTE')}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.6' }}>
                    <div>Unit Type: <strong style={{ color: '#f8fafc' }}>{truck.unit_type === 'HEAVY_TOW_TRUCK' ? 'Heavy Tow Truck' : 'Patrol Interceptor'}</strong></div>
                    <div>Target Incident: <strong style={{ color: '#38bdf8' }}>{truck.ticket_id || 'Incident'}</strong></div>
                    <div>Station Base: <strong>{truck.police_station || 'Central HQ'}</strong></div>
                    {truck.eta_mins && (
                      <div>Dijkstra ETA: <strong style={{ color: '#f59e0b' }}>{truck.eta_mins} mins ({truck.dist_km || 2.4} km)</strong></div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginBottom: '3px' }}>
                      <span>En Route Progress</span>
                      <span>{Math.round((truck.progress || 0) * 100)}%</span>
                    </div>
                    <div style={{ height: '5px', backgroundColor: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, (truck.progress || 0) * 100)}%`,
                        backgroundColor: isArrived ? '#10b981' : '#f59e0b',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      map.flyTo([truck.currentPos.lat, truck.currentPos.lon], 16, { duration: 1 })
                    }}
                    style={{
                      marginTop: '10px',
                      width: '100%',
                      padding: '6px 0',
                      borderRadius: '6px',
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '600',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Track Unit Camera Focus
                  </button>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        )
      })}
    </>
  )
}
