import { useState, useCallback } from 'react'
import MapArea from './components/MapArea'
import Sidebar from './components/Sidebar'
import TimeSlider from './components/TimeSlider'
import { useData } from './hooks/useData'

export default function App() {
  const [hourMin, setHourMin] = useState(0)
  const [hourMax, setHourMax] = useState(23)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [showMarkers, setShowMarkers] = useState(true)
  const [showClusters, setShowClusters] = useState(true)
  const [flyToTarget, setFlyToTarget] = useState(null)
  const [simulatePin, setSimulatePin] = useState(null)

  const { reports, heatmap, clusters, stats, timeline, loading, error } = useData(hourMin, hourMax)

  const handleRangeChange = useCallback((min, max) => {
    setHourMin(min)
    setHourMax(max)
  }, [])

  const handleHotspotClick = useCallback((cluster) => {
    setFlyToTarget({ lat: cluster.latitude, lon: cluster.longitude })
  }, [])

  const handleSimulateResult = useCallback((pin) => {
    setSimulatePin(pin)
    setFlyToTarget({ lat: pin.lat, lon: pin.lon })
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col bg-mesh overflow-hidden">

      {/* ── Top Header Bar ── */}
      <header className="glass z-20 flex items-center justify-between px-5 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,255,0.2), rgba(0,180,216,0.1))',
              border: '1px solid rgba(0,229,255,0.3)',
              boxShadow: '0 0 12px rgba(0,229,255,0.15)',
            }}>
            <span style={{ fontSize: '16px' }}>🚦</span>
          </div>

          <div>
            <h1 className="text-sm font-black gradient-text leading-none">
              Parking Intelligence
            </h1>
            <p className="text-xs text-slate-500">Bengaluru Traffic Command</p>
          </div>
        </div>

        {/* Centre — story arc */}
        <div className="hidden md:flex items-center gap-1 text-xs text-slate-500">
          {[
            { icon: '📋', label: 'Raw Reports', color: '#64748b' },
            { icon: '→', label: '', color: '#334155' },
            { icon: '✅', label: 'Validated', color: '#00e676' },
            { icon: '→', label: '', color: '#334155' },
            { icon: '⚡', label: 'Scored', color: '#ff9100' },
            { icon: '→', label: '', color: '#334155' },
            { icon: '🔥', label: 'Clustered', color: '#ff1744' },
            { icon: '→', label: '', color: '#334155' },
            { icon: '🚔', label: 'Dispatched', color: '#00e5ff' },
          ].map((step, i) => (
            <span key={i} style={{ color: step.color, fontWeight: step.label ? '500' : 'normal' }}>
              {step.icon} {step.label}
            </span>
          ))}
        </div>

        {/* Right — layer toggles + status */}
        <div className="flex items-center gap-3">
          {/* Layer controls */}
          <div className="flex items-center gap-2">
            {[
              { key: 'heatmap', state: showHeatmap, setter: setShowHeatmap, icon: '🌡', label: 'Heat' },
              { key: 'markers', state: showMarkers, setter: setShowMarkers, icon: '📍', label: 'Points' },
              { key: 'clusters', state: showClusters, setter: setShowClusters, icon: '🔴', label: 'Zones' },
            ].map(layer => (
              <button
                key={layer.key}
                onClick={() => layer.setter(p => !p)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200"
                style={{
                  background: layer.state
                    ? 'rgba(0,229,255,0.12)'
                    : 'rgba(255,255,255,0.04)',
                  border: layer.state
                    ? '1px solid rgba(0,229,255,0.3)'
                    : '1px solid rgba(255,255,255,0.06)',
                  color: layer.state ? '#00e5ff' : '#475569',
                }}
              >
                <span>{layer.icon}</span>
                <span className="hidden sm:inline">{layer.label}</span>
              </button>
            ))}
          </div>

          {/* Loading indicator */}
          {loading && <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />}

          {/* Model status */}
          {stats && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
              style={{
                background: stats.m1_loaded && stats.m2_loaded
                  ? 'rgba(0,230,118,0.08)'
                  : 'rgba(255,234,0,0.08)',
                border: `1px solid ${stats.m1_loaded && stats.m2_loaded ? 'rgba(0,230,118,0.3)' : 'rgba(255,234,0,0.3)'}`,
                color: stats.m1_loaded && stats.m2_loaded ? '#00e676' : '#ffea00',
              }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: 'currentColor',
                boxShadow: '0 0 6px currentColor',
                display: 'inline-block',
              }} />
              {stats.m1_loaded && stats.m2_loaded ? 'ML Models Active' : 'Heuristic Mode'}
            </div>
          )}
        </div>
      </header>

      {/* ── Main Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="w-72 shrink-0 overflow-hidden z-10">
          <Sidebar
            stats={stats}
            clusters={clusters}
            onHotspotClick={handleHotspotClick}
            onSimulateResult={handleSimulateResult}
          />
        </aside>

        {/* ── Map + Time Slider ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-2 px-3 py-2 rounded-lg text-xs text-red-400 animate-fade-in"
              style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.2)' }}>
              ⚠ Backend error: {error} — Ensure the FastAPI server is running on port 8000.
            </div>
          )}

          {/* Map */}
          <div className="flex-1 relative">
            {/* Loading overlay */}
            {loading && reports.length === 0 && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
                style={{ background: 'rgba(4,13,28,0.8)', backdropFilter: 'blur(4px)' }}>
                <div className="spinner mb-4" />
                <div className="text-slate-400 text-sm font-medium">
                  Running 3-Stage AI Pipeline...
                </div>
                <div className="text-slate-600 text-xs mt-1">
                  Gatekeeper → Impact Quantifier → Hotspot Clusterer
                </div>
              </div>
            )}

            <MapArea
              reports={reports}
              heatmap={heatmap}
              clusters={clusters}
              showHeatmap={showHeatmap}
              showMarkers={showMarkers}
              showClusters={showClusters}
              flyToTarget={flyToTarget}
              simulatePin={simulatePin}
            />

            {/* Map legend */}
            <div className="absolute bottom-4 right-4 z-10 glass rounded-xl p-3 text-xs space-y-1.5">
              <div className="text-slate-400 font-medium mb-1.5 text-xs uppercase tracking-wider">
                Severity
              </div>
              {[
                { color: '#00e676', label: 'Low (0–25%)' },
                { color: '#ffea00', label: 'Moderate (25–50%)' },
                { color: '#ff9100', label: 'High (50–75%)' },
                { color: '#ff1744', label: 'Critical (75–100%)' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
                  <span className="text-slate-400">{label}</span>
                </div>
              ))}
              <div className="pt-1.5 border-t border-white/5 mt-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm border"
                    style={{ borderColor: '#ff6d00', background: 'rgba(255,109,0,0.1)' }} />
                  <span className="text-slate-400">Hotspot Zone</span>
                </div>
              </div>
            </div>

            {/* Point count badge */}
            {reports.length > 0 && (
              <div className="absolute top-3 left-3 z-10 glass-light rounded-lg px-2.5 py-1.5 text-xs animate-fade-in">
                <span className="text-slate-400">Showing </span>
                <span className="font-semibold gradient-text">{reports.length.toLocaleString()}</span>
                <span className="text-slate-400"> violations</span>
                {clusters.length > 0 && (
                  <>
                    <span className="text-slate-500"> · </span>
                    <span className="font-semibold" style={{ color: '#ff9100' }}>{clusters.length}</span>
                    <span className="text-slate-400"> hotspots</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Time Slider ── */}
          <div className="px-4 pb-3 pt-2 shrink-0">
            <TimeSlider
              timeline={timeline}
              onRangeChange={handleRangeChange}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
