import React from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import { CheckCircle2, ShieldAlert, Truck, AlertTriangle } from 'lucide-react'

function getSeverityColor(score = 0.75) {
  if (score < 0.25) return '#10B981' // low
  if (score < 0.5)  return '#F59E0B' // moderate
  if (score < 0.75) return '#EF4444' // high
  return '#DC2626' // critical
}

export default function LiveQueryMarkers({ activeQueries = [], onResolveQuery, onSelectQuery }) {
  if (!activeQueries || activeQueries.length === 0) return null

  return (
    <>
      {activeQueries.map((item) => {
        if (!item.latitude || !item.longitude) return null

        const color = getSeverityColor(item.severity_score)
        const isEscalate = item.action === 'ESCALATE' || item.status === 'PENDING'

        return (
          <React.Fragment key={item.ticket_id}>
            {/* Outer Pulsing Aura Circle */}
            <CircleMarker
              center={[item.latitude, item.longitude]}
              radius={18}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.25,
                weight: 2,
                dashArray: isEscalate ? '4 4' : undefined,
              }}
            />

            {/* Inner Core Pin */}
            <CircleMarker
              center={[item.latitude, item.longitude]}
              radius={9}
              pathOptions={{
                color: '#FFFFFF',
                fillColor: color,
                fillOpacity: 1.0,
                weight: 2.5,
              }}
            >
              <Popup>
                <div className="p-1 min-w-[220px] font-sans">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2 border-b pb-1.5 mb-2 border-slate-700">
                    <span className="font-mono font-bold text-xs text-amber-400">
                      {item.ticket_id}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: `${color}25`,
                        color: color,
                        border: `1px solid ${color}50`
                      }}
                    >
                      {item.action || 'LIVE INCIDENT'}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="text-xs space-y-1 text-slate-200 mb-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Station:</span>
                      <strong className="text-white">{item.police_station || 'Unknown'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Junction:</span>
                      <strong className="text-amber-300">{item.junction_name || 'Corridor'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Severity:</span>
                      <strong style={{ color }}>{((item.severity_score || 0.75) * 100).toFixed(0)}%</strong>
                    </div>
                    {item.reasoning && (
                      <div className="mt-1.5 p-1.5 rounded bg-slate-800 text-[11px] italic text-slate-300 border border-slate-700">
                        "{item.reasoning}"
                      </div>
                    )}
                  </div>

                  {/* Actions: Direct 1-Click Resolve Button (Removes from Map!) */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={() => onResolveQuery(item)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-1 shadow-md transition-colors"
                      title="Mark incident resolved and remove marker from map!"
                    >
                      <CheckCircle2 size={14} />
                      <span>Resolve & Clear</span>
                    </button>
                    {onSelectQuery && (
                      <button
                        onClick={() => onSelectQuery(item)}
                        className="py-1.5 px-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs transition-colors"
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          </React.Fragment>
        )
      })}
    </>
  )
}
