import { useState } from 'react'
import { Hexagon, BarChart3, MapPin, FlaskConical, CheckCircle, Activity, Layers, ChevronDown, ChevronUp, Truck } from 'lucide-react'
import StatsCards from './StatsCards'
import SimulateForm from './SimulateForm'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const VEHICLE_COLORS = {
  SCOOTER: '#0C73EB', 'MOTOR CYCLE': '#0C73EB', CAR: '#0C73EB',
  'PASSENGER AUTO': '#F8D706', 'GOODS AUTO': '#F09120',
  'MAXI-CAB': '#F09120', BUS: '#EF4444', TRUCK: '#DC2626',
  OTHERS: '#5C6C84',
}

function getVehicleColor(name) {
  return VEHICLE_COLORS[name] || '#5C6C84'
}

function getRiskBadge(sev) {
  if (sev < 0.25) return { label: 'Low', tokenClass: 'bg-risk-low/15 text-risk-low' }
  if (sev < 0.5)  return { label: 'Med', tokenClass: 'bg-risk-moderate/15 text-risk-moderate' }
  if (sev < 0.75) return { label: 'High', tokenClass: 'bg-risk-high/15 text-risk-high' }
  return { label: 'CRIT', tokenClass: 'bg-risk-critical/15 text-risk-critical' }
}

function getRiskBarColor(sev) {
  if (sev < 0.25) return 'bg-risk-low'
  if (sev < 0.5)  return 'bg-risk-moderate'
  if (sev < 0.75) return 'bg-risk-high'
  return 'bg-risk-critical'
}

const TABS = [
  { id: 'Live Map', icon: BarChart3, label: 'Live Map' },
  { id: 'Dispatch Zones', icon: MapPin, label: 'Dispatch Zones' },
  { id: 'What-If', icon: FlaskConical, label: 'What-If' },
]

export default function Sidebar({ stats, clusters, onHotspotClick, onSimulateResult }) {
  const [tab, setTab] = useState('Live Map')
  const [showCascade, setShowCascade] = useState(false)

  return (
    <div className="h-full flex flex-col bg-bg-canvas border-r border-bg-border overflow-hidden w-full">

      {/* ── Logo Area ── */}
      <div className="h-[60px] flex items-center gap-2.5 px-4 border-b border-bg-border shrink-0">
        <Hexagon size={24} className="text-accent-yellow fill-accent-yellow/20" />
        <span className="text-lg font-medium text-accent-yellow tracking-tight">TrafficCop AI</span>
      </div>

      {/* ── Model status badge ── */}
      {stats && (
        <div className="px-4 py-2.5 border-b border-bg-border">
          <button
            onClick={() => setShowCascade(p => !p)}
            className="w-full text-left flex items-center justify-between"
          >
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">3-Stage AI Cascade</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-medium ${stats.m1_loaded && stats.m2_loaded ? 'text-risk-low' : 'text-risk-moderate'}`}>
                {stats.m1_loaded && stats.m2_loaded ? 'Active' : 'Heuristic'}
              </span>
              {showCascade ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
            </div>
          </button>
          {showCascade && (
            <div className="mt-2 space-y-1 animate-fade-in">
              {[
                { label: 'Stage 1: Triage (Filter)', loaded: stats.m1_loaded, desc: 'Filters invalid reports' },
                { label: 'Stage 2: Impact Score', loaded: stats.m2_loaded, desc: 'Scores 0-100% severity' },
                { label: 'Stage 3: Dispatch Zone', loaded: true, desc: `${stats.num_clusters} zones detected` },
              ].map(m => (
                <div key={m.label} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-bg-hover/50">
                  <span className={`mt-0.5 ${m.loaded ? 'text-risk-low' : 'text-text-muted'}`} style={{ fontSize: '10px' }}>
                    {m.loaded ? '\u25CF' : '\u25CB'}
                  </span>
                  <div>
                    <div className={`text-xs font-medium ${m.loaded ? 'text-text-primary' : 'text-text-muted'}`}>
                      {m.label}
                    </div>
                    <div className="text-xs text-text-muted">{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex px-4 pt-2 gap-1 border-b border-bg-border">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-t-lg font-medium transition-colors ${
                active
                  ? 'bg-accent-blue/10 text-accent-blue border-b-2 border-accent-blue'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover border-b-2 border-transparent'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
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
                <h3 className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">
                  Vehicle Type Breakdown
                </h3>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={stats.vehicle_breakdown} barSize={12}>
                    <XAxis
                      dataKey="vehicle_type"
                      tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 9 }}
                      tickFormatter={v => v.split(' ')[0].slice(0, 6)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgb(var(--color-bg-card))',
                        border: '1px solid rgb(var(--color-bg-border))',
                        borderRadius: '8px',
                        color: 'rgb(var(--color-text-primary))',
                        fontSize: '11px',
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
                <h3 className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">
                  Top Stations by Violations
                </h3>
                <div className="space-y-1.5">
                  {stats.top_stations.slice(0, 6).map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-text-muted w-4 text-right">{i + 1}.</span>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-xs text-text-primary truncate max-w-28">{s.station}</span>
                          <span className="text-xs font-mono text-text-muted">{s.violations}</span>
                        </div>
                        <div className="bg-bg-border/30 rounded-sm h-[3px]">
                          <div
                            className="h-full rounded-sm bg-accent-blue"
                            style={{ width: `${(s.violations / stats.top_stations[0].violations) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Context */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">
                  System Context
                </h3>
                <div className="bg-bg-card border border-bg-border rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-risk-low" />
                    <div>
                      <div className="text-xs font-medium text-text-primary">Clear / 28 C</div>
                      <div className="text-xs text-text-muted">Normal Conditions</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-accent-orange" />
                    <div>
                      <div className="text-xs font-medium text-accent-orange">Heavy Traffic</div>
                      <div className="text-xs text-text-muted">Central CBD</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">
                  Live Dispatch Feed
                </h3>
                <div className="space-y-1.5">
                  {stats?.top_stations?.slice(0, 4).map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs py-1">
                      <span className="font-mono text-text-muted mt-0.5">
                        {new Date(Date.now() - i * 150000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      <div>
                        <span className="text-text-secondary">Violation detected at </span>
                        <span className="font-medium text-accent-blue">{s.station}</span>
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
            <p className="text-xs text-text-muted mb-3">
              {clusters.length} DBSCAN hotspot zones detected.
              Click to fly to location.
            </p>
            <div className="space-y-2">
              {clusters.slice(0, 20).map((c, i) => {
                const badge = getRiskBadge(c.avg_severity)
                const barColor = getRiskBarColor(c.avg_severity)
                const isTop3 = i < 3
                return (
                  <div key={c.cluster_id} className={`w-full text-left bg-bg-card border border-bg-border rounded-xl p-3 transition-all ${c._dispatched ? 'opacity-50 grayscale' : ''}`}>
                    <button
                      onClick={() => onHotspotClick?.(c)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-medium text-accent-yellow">
                              #{i + 1}
                            </span>
                            <span className="text-xs text-text-primary truncate">{c.top_station}</span>
                          </div>
                          <div className="text-xs text-text-muted">
                            {c.count} violations · {c.radius_m.toFixed(0)}m radius
                          </div>
                          {/* Severity bar */}
                          <div className="mt-1.5 bg-bg-border/30 rounded-sm h-[4px]">
                            <div
                              className={`h-full rounded-sm ${barColor}`}
                              style={{ width: `${c.avg_severity * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${badge.tokenClass}`}>
                            {badge.label}
                          </span>
                          <span className="text-xs font-mono text-text-muted">
                            {(c.avg_severity * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </button>
                    {isTop3 && !c._dispatched && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          c._dispatched = true
                          document.getElementById(`btn-disp-${c.cluster_id}`).innerText = 'Dispatched'
                          document.getElementById(`btn-disp-${c.cluster_id}`).disabled = true
                          document.getElementById(`btn-disp-${c.cluster_id}`).style.opacity = '0.5'
                        }}
                        id={`btn-disp-${c.cluster_id}`}
                        className="mt-3 w-full py-1.5 rounded-lg bg-accent-yellow text-bg-canvas text-xs font-medium hover:opacity-90 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Truck size={14} />
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
              <h3 className="text-sm font-medium text-text-primary mb-1">
                Report a New Violation
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Drop a pin and run it through the AI cascade to estimate dispatch urgency.
              </p>
            </div>
            <SimulateForm onResult={onSimulateResult} />
          </div>
        )}
      </div>

      {/* ── Bottom Status ── */}
      <div className="px-4 py-3 border-t border-bg-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-risk-low" />
          <span className="text-xs font-medium text-text-muted">All Systems Nominal</span>
        </div>
      </div>
    </div>
  )
}
