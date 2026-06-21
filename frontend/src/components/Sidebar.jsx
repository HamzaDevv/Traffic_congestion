import { useState } from 'react'
import StatsCards from './StatsCards'
import SimulateForm from './SimulateForm'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const VEHICLE_COLORS = {
  SCOOTER: '#00e5ff', 'MOTOR CYCLE': '#00b4d8', CAR: '#0096c7',
  'PASSENGER AUTO': '#ffea00', 'GOODS AUTO': '#ff9100',
  'MAXI-CAB': '#ff6d00', BUS: '#ff1744', TRUCK: '#c62828',
  OTHERS: '#64748b',
}

function getVehicleColor(name) {
  return VEHICLE_COLORS[name] || '#334155'
}

function getRiskBadge(sev) {
  if (sev < 0.25) return { label: 'Low', color: '#00e676' }
  if (sev < 0.5)  return { label: 'Med', color: '#ffea00' }
  if (sev < 0.75) return { label: 'High', color: '#ff9100' }
  return { label: 'CRIT', color: '#ff1744' }
}

const TABS = ['Live Map', 'Dispatch Zones', 'What-If']

export default function Sidebar({ stats, clusters, onHotspotClick, onSimulateResult }) {
  const [tab, setTab] = useState('Overview')
  const [showCascade, setShowCascade] = useState(false)

  return (
    <div className="h-full flex flex-col glass overflow-hidden" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00e676', boxShadow: '0 0 8px #00e676' }} />
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Live Intelligence</span>
        </div>
        <h1 className="text-lg font-black gradient-text leading-tight">
          Traffic Operations
        </h1>
        <p className="text-xs text-slate-500">Bengaluru · Enforcement Intelligence</p>
      </div>

      {/* ── Model status badge ── */}
      {stats && (
        <div className="px-4 py-2"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <button
            onClick={() => setShowCascade(p => !p)}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">3-Stage AI Cascade</span>
              <span className="text-xs" style={{ color: '#00e676' }}>
                {stats.m1_loaded && stats.m2_loaded ? '● Active' : '○ Heuristic'}
              </span>
            </div>
          </button>
          {showCascade && (
            <div className="mt-2 space-y-1 animate-fade-in">
              {[
                { label: '① Triage (Filter)', loaded: stats.m1_loaded, desc: 'Filters invalid reports' },
                { label: '② Impact Score (Scorer)', loaded: stats.m2_loaded, desc: 'Scores 0–100% severity' },
                { label: '③ Dispatch Zone (Clusterer)', loaded: true, desc: `${stats.num_clusters} zones detected` },
              ].map(m => (
                <div key={m.label} className="flex items-start gap-2 px-2 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <span style={{ color: m.loaded ? '#00e676' : '#64748b', fontSize: '10px', marginTop: '1px' }}>
                    {m.loaded ? '●' : '○'}
                  </span>
                  <div>
                    <div className="text-xs font-medium" style={{ color: m.loaded ? '#e2e8f0' : '#64748b' }}>
                      {m.label}
                    </div>
                    <div className="text-xs text-slate-500">{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex px-4 pt-2 gap-1"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 text-xs py-2 rounded-t-lg font-medium transition-all duration-150"
            style={{
              color: tab === t ? '#00e5ff' : '#475569',
              borderBottom: tab === t ? '2px solid #00e5ff' : '2px solid transparent',
              background: tab === t ? 'rgba(0,229,255,0.05)' : 'transparent',
            }}
          >
            {t === 'Live Map' ? '📊' : t === 'Dispatch Zones' ? '🔥' : '🤖'} {t}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3">

        {/* ── OVERVIEW TAB ── */}
        {tab === 'Live Map' && (
          <div className="animate-fade-in space-y-4">
            <StatsCards stats={stats} />

            {/* Vehicle breakdown */}
            {stats?.vehicle_breakdown?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Vehicle Type Breakdown
                </h3>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={stats.vehicle_breakdown} barSize={12}>
                    <XAxis
                      dataKey="vehicle_type"
                      tick={{ fill: '#475569', fontSize: 9 }}
                      tickFormatter={v => v.split(' ')[0].slice(0, 6)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(7,21,41,0.95)',
                        border: '1px solid rgba(0,229,255,0.2)',
                        borderRadius: '8px', color: '#e2e8f0', fontSize: '11px',
                      }}
                      formatter={(v) => [v, 'Violations']}
                    />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                      {stats.vehicle_breakdown.map((entry, i) => (
                        <Cell key={i} fill={getVehicleColor(entry.vehicle_type)} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top stations */}
            {stats?.top_stations?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Top Stations by Violations
                </h3>
                <div className="space-y-1.5">
                  {stats.top_stations.slice(0, 6).map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 w-4 text-right">{i + 1}.</span>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-xs text-slate-300 truncate max-w-28">{s.station}</span>
                          <span className="text-xs text-slate-500">{s.violations}</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '2px', height: '3px' }}>
                          <div style={{
                            width: `${(s.violations / stats.top_stations[0].violations) * 100}%`,
                            height: '100%',
                            borderRadius: '2px',
                            background: 'linear-gradient(90deg, #00b4d8, #00e5ff)',
                          }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Recent Activity & Context */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  System Context
                </h3>
                <div className="glass-light rounded-xl p-3 flex items-center justify-between border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌤</span>
                    <div>
                      <div className="text-xs text-slate-200 font-medium">Clear / 28°C</div>
                      <div className="text-xs text-slate-500">Normal Conditions</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚗</span>
                    <div>
                      <div className="text-xs text-amber-500 font-medium">Heavy Traffic</div>
                      <div className="text-xs text-slate-500">Central CBD</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Live Dispatch Feed
                </h3>
                <div className="space-y-1.5">
                  {stats?.top_stations?.slice(0, 4).map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs py-1">
                      <span className="text-slate-500 font-mono mt-0.5">
                        {new Date(Date.now() - i * 150000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      <div>
                        <span className="text-slate-200">Violation detected</span> at <span className="font-medium text-cyan-glow">{s.station}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── HOTSPOTS TAB ── */}
        {tab === 'Dispatch Zones' && (
          <div className="animate-fade-in">
            <p className="text-xs text-slate-500 mb-3">
              {clusters.length} DBSCAN hotspot zones detected.
              Click to fly to location.
            </p>
            <div className="space-y-2">
              {clusters.slice(0, 20).map((c, i) => {
                const badge = getRiskBadge(c.avg_severity)
                const isTop3 = i < 3
                return (
                  <div key={c.cluster_id} className={`w-full text-left glass-light rounded-xl p-3 kpi-card transition-all ${c._dispatched ? 'opacity-50 grayscale' : ''}`} style={{ border: `1px solid ${badge.color}18` }}>
                    <button
                      onClick={() => onHotspotClick?.(c)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-bold" style={{ color: badge.color }}>
                              #{i + 1}
                            </span>
                            <span className="text-xs text-slate-300 truncate">{c.top_station}</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {c.count} violations · {c.radius_m.toFixed(0)}m radius
                          </div>
                          {/* Severity bar */}
                          <div style={{
                            marginTop: '6px',
                            background: 'rgba(255,255,255,0.06)',
                            borderRadius: '3px', height: '4px',
                          }}>
                            <div style={{
                              width: `${c.avg_severity * 100}%`,
                              height: '100%',
                              borderRadius: '3px',
                              background: badge.color,
                              boxShadow: `0 0 6px ${badge.color}60`,
                            }} />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{
                              color: badge.color,
                              background: `${badge.color}18`,
                              border: `1px solid ${badge.color}40`,
                            }}
                          >
                            {badge.label}
                          </span>
                          <span className="text-xs" style={{ color: badge.color }}>
                            {(c.avg_severity * 100).toFixed(0)}%
                          </span>
                          <span className="text-xs text-slate-600">📍</span>
                        </div>
                      </div>
                    </button>
                    {isTop3 && !c._dispatched && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          c._dispatched = true
                          // Force a re-render by calling a dummy function or just letting state naturally update if we had one.
                          // Mutating props is dirty but works for a quick demo interaction.
                          document.getElementById(`btn-disp-${c.cluster_id}`).innerText = '✓ Dispatched'
                          document.getElementById(`btn-disp-${c.cluster_id}`).disabled = true
                          document.getElementById(`btn-disp-${c.cluster_id}`).style.opacity = '0.5'
                        }}
                        id={`btn-disp-${c.cluster_id}`}
                        className="mt-3 w-full py-1.5 rounded bg-cyan-glow/10 text-cyan-glow text-xs font-semibold border border-cyan-glow/30 hover:bg-cyan-glow/20 transition-colors"
                      >
                        Dispatch Tow Truck
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── SIMULATE TAB ── */}
        {tab === 'What-If' && (
          <div className="animate-fade-in">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-200 mb-1">
                Report a New Violation
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Drop a pin and run it through the AI cascade to estimate dispatch urgency.
              </p>
            </div>
            <SimulateForm onResult={onSimulateResult} />
          </div>
        )}
      </div>
    </div>
  )
}
