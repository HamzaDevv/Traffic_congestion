import { useState, useCallback, useEffect } from 'react'
import { Sun, Moon, Bell, Hexagon, Menu, X, ShieldAlert, Cpu } from 'lucide-react'
import MapArea from './components/MapArea'
import Sidebar from './components/Sidebar'
import TimeSlider from './components/TimeSlider'
import HitlOverrideModal from './components/HitlOverrideModal'
import ToolExecutionLog from './components/ToolExecutionLog'
import { useData } from './hooks/useData'
import { predictAction, postHumanFeedback, fetchRlMetrics } from './api'

function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme')
    return stored ? stored === 'dark' : true // dark by default
  })

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <button
      onClick={() => setDark(d => !d)}
      className="p-2 rounded-lg bg-bg-canvas border border-bg-border hover:bg-bg-hover transition-colors"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun size={18} className="text-text-secondary" /> : <Moon size={18} className="text-text-secondary" />}
    </button>
  )
}

function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="font-mono text-sm text-text-muted hidden sm:inline">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
}

export default function App() {
  const [hourMin, setHourMin] = useState(0)
  const [hourMax, setHourMax] = useState(23)
  const [cascadeStage, setCascadeStage] = useState(4)
  const [flyToTarget, setFlyToTarget] = useState(null)
  const [simulatePin, setSimulatePin] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Stage 4 RL & HITL States
  const [hitlModalOpen, setHitlModalOpen] = useState(false)
  const [activePrediction, setActivePrediction] = useState(null)
  const [rlMetrics, setRlMetrics] = useState(null)

  const { reports, heatmap, clusters, stats, timeline, loading, error } = useData(hourMin, hourMax, cascadeStage >= 1)

  useEffect(() => {
    fetchRlMetrics().then(data => setRlMetrics(data)).catch(() => {})
  }, [])

  const handleRangeChange = useCallback((min, max) => {
    setHourMin(min)
    setHourMax(max)
  }, [])

  const handleHotspotClick = useCallback(async (cluster) => {
    setFlyToTarget({ lat: cluster.latitude, lon: cluster.longitude })
    setSidebarOpen(false)

    // Trigger Stage 4 RL SOP Evaluation on hotspot click
    try {
      const pred = await predictAction({
        ticket_id: `CLUST_${cluster.cluster_id}`,
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        police_station: cluster.top_station || 'Madiwala',
        junction_name: 'Silk Board Junction',
        severity_score: cluster.avg_severity || 0.75,
        report_count: cluster.count || 5
      })
      setActivePrediction(pred)

      // If low confidence or ESCALATE -> open HITL Modal
      if (!pred.auto_execute || pred.action === 'ESCALATE') {
        setHitlModalOpen(true)
      }
    } catch (err) {
      console.error('RL Action Prediction failed:', err)
    }
  }, [])

  const handleSimulateResult = useCallback(async (pin) => {
    setSimulatePin(pin)
    setFlyToTarget({ lat: pin.lat, lon: pin.lon })
    setSidebarOpen(false)

    // Run Stage 4 RL SOP Policy on simulated report
    try {
      const pred = await predictAction({
        ticket_id: `SIM_${Date.now().toString().slice(-4)}`,
        latitude: pin.lat,
        longitude: pin.lon,
        police_station: 'Madiwala',
        junction_name: pin.junction_name || 'Silk Board Junction',
        severity_score: pin.severity_score || 0.75,
        report_count: 1
      })
      setActivePrediction(pred)

      if (!pred.auto_execute || pred.action === 'ESCALATE') {
        setHitlModalOpen(true)
      }
    } catch (err) {
      console.error('RL Prediction failed on simulation:', err)
    }
  }, [])

  const handleHumanFeedbackSubmit = async (feedbackData) => {
    await postHumanFeedback(feedbackData)
    // Refresh metrics
    const updated = await fetchRlMetrics()
    setRlMetrics(updated)
  }

  const stageLabels = [
    { id: 0, label: 'Raw' },
    { id: 1, label: 'Validated' },
    { id: 2, label: 'Scored' },
    { id: 3, label: 'Clustered' },
    { id: 4, label: 'RL Dispatched' },
  ]

  return (
    <div className="flex h-screen w-full bg-bg-page overflow-hidden">

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar — Desktop: fixed, Mobile: slide-out overlay ── */}
      <aside
        className={`
          fixed md:relative z-50 md:z-auto
          h-screen w-[340px] shrink-0
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:flex
        `}
      >
        <Sidebar
          stats={stats}
          clusters={clusters}
          onHotspotClick={handleHotspotClick}
          onSimulateResult={handleSimulateResult}
        />
        {/* Close button for mobile */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-3 right-3 p-1.5 rounded-lg bg-bg-hover text-text-secondary md:hidden z-10"
        >
          <X size={18} />
        </button>
      </aside>

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Navbar ── */}
        <header className="sticky top-0 z-40 h-[60px] bg-bg-page border-b border-bg-border flex items-center justify-between px-3 sm:px-4 md:px-6 shrink-0">
          {/* Left — Hamburger + Connection Status */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg bg-bg-canvas border border-bg-border hover:bg-bg-hover transition-colors md:hidden shrink-0"
            >
              <Menu size={18} className="text-text-secondary" />
            </button>

            <div className="flex items-center gap-2 rounded-full bg-bg-canvas border border-bg-border px-2.5 sm:px-3 py-1.5 shrink-0">
              <div className="w-2 h-2 rounded-full bg-risk-low" />
              <span className="text-xs font-medium text-text-secondary hidden sm:inline">
                Qwen 2.5 0.5B RL Active
              </span>
              <span className="text-xs font-medium text-text-secondary sm:hidden">
                RL Active
              </span>
            </div>

            {/* Stage Toggles */}
            <div className="hidden xl:flex items-center gap-1 bg-bg-canvas border border-bg-border rounded-lg p-1">
              {stageLabels.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => setCascadeStage(stage.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    cascadeStage >= stage.id
                      ? 'bg-accent-blue/10 text-accent-blue'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  {stage.label}
                </button>
              ))}
            </div>

            {loading && <div className="spinner shrink-0" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />}
          </div>

          {/* Right — Clock, Theme, Bell, Avatar */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LiveClock />
            <ThemeToggle />
            <button
              onClick={() => {
                if (activePrediction) setHitlModalOpen(true)
              }}
              title="Test HITL Officer Modal"
              className="relative p-2 rounded-lg bg-bg-canvas border border-bg-border hover:bg-bg-hover transition-colors text-amber-500"
            >
              <ShieldAlert size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            </button>
            <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-bg-border">
              <div className="w-8 h-8 rounded-full bg-accent-blue/15 flex items-center justify-center">
                <span className="text-xs font-medium text-accent-blue">TC</span>
              </div>
              <span className="text-sm font-medium text-text-primary">Officer</span>
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Error banner */}
          {error && (
            <div className="mx-2 sm:mx-4 mt-2 p-3 sm:p-4 bg-risk-critical/10 border border-risk-critical/30 rounded-xl text-xs sm:text-sm font-medium text-risk-critical animate-fade-in">
              Backend error: {error} — Ensure the FastAPI server is running on port 8000.
            </div>
          )}

          {/* Map */}
          <div className="flex-1 relative">
            {/* Loading overlay */}
            {loading && reports.length === 0 && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-bg-page/80">
                <div className="spinner mb-4" />
                <div className="text-sm font-medium text-text-secondary">
                  Running 4-Stage AI & RL Pipeline...
                </div>
                <div className="text-xs text-text-muted mt-1">
                  Gatekeeper → Impact Quantifier → Hotspot Clusterer → Qwen 2.5 RL SOP Policy
                </div>
              </div>
            )}

            <MapArea
              reports={reports}
              heatmap={heatmap}
              clusters={clusters}
              showHeatmap={cascadeStage >= 2}
              showMarkers={true}
              showClusters={cascadeStage >= 3}
              cascadeStage={cascadeStage}
              flyToTarget={flyToTarget}
              simulatePin={simulatePin}
            />

            {/* Map legend */}
            <div className="absolute bottom-4 right-4 z-10 bg-bg-card border border-bg-border rounded-xl p-3 text-xs space-y-1.5 hidden sm:block">
              <div className="text-text-muted font-medium mb-1.5 text-xs uppercase tracking-widest">
                Severity & RL SOP
              </div>
              {[
                { token: 'risk-low', label: 'Low / REJECT (0-25%)' },
                { token: 'risk-moderate', label: 'Moderate / VERIFY (25-50%)' },
                { token: 'risk-high', label: 'High / DISPATCH (50-75%)' },
                { token: 'risk-critical', label: 'Critical / ESCALATE (75-100%)' },
              ].map(({ token, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full shrink-0 bg-${token}`} />
                  <span className="text-text-secondary">{label}</span>
                </div>
              ))}
            </div>

            {/* Live Tool Execution Log Overlay */}
            {activePrediction && activePrediction.tool_calls_executed && (
              <div className="absolute bottom-4 left-4 z-10 max-w-sm w-full hidden lg:block">
                <ToolExecutionLog
                  toolCalls={activePrediction.tool_calls_executed}
                  metrics={rlMetrics}
                />
              </div>
            )}
          </div>

          {/* ── Time Slider ── */}
          <div className="px-2 sm:px-4 pb-2 sm:pb-3 pt-1 sm:pt-2 shrink-0">
            <TimeSlider
              timeline={timeline}
              onRangeChange={handleRangeChange}
            />
          </div>
        </div>
      </div>

      {/* ── HITL Officer Override Modal ── */}
      <HitlOverrideModal
        isOpen={hitlModalOpen}
        prediction={activePrediction}
        onClose={() => setHitlModalOpen(false)}
        onSubmitFeedback={handleHumanFeedbackSubmit}
      />

      {/* ── GitHub FAB ── */}
      <a
        href="https://github.com/HamzaDevv/Traffic_congestion"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 p-3 sm:p-4 bg-accent-yellow text-bg-canvas rounded-full shadow-lg shadow-accent-yellow/20 hover:scale-110 hover:shadow-accent-yellow/40 transition-all cursor-pointer"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
        </svg>
      </a>
    </div>
  )
}
