import { useState, useCallback, useEffect, useRef } from 'react'
import { Sun, Moon, Bell, Hexagon, Menu, X, ShieldAlert, Cpu, Truck, Zap, Activity } from 'lucide-react'
import MapArea from './components/MapArea'
import Sidebar from './components/Sidebar'
import TimeSlider from './components/TimeSlider'
import HitlOverrideModal from './components/HitlOverrideModal'
import ToolExecutionLog from './components/ToolExecutionLog'
import LiveStreamBar from './components/LiveStreamBar'
import { useData } from './hooks/useData'
import { predictAction, postHumanFeedback, fetchRlMetrics, STATION_COORDS, generateDijkstraWaypoints, fetchLiveStreamStatus, controlLiveStream, triggerInstantLiveQuery } from './api'

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

// Initial seed data for HITL Queue to show live agent activity immediately
const INITIAL_QUEUE_SEED = [
  {
    ticket_id: 'CLUST_14',
    police_station: 'Madiwala',
    junction_name: 'Silk Board Junction',
    latitude: 12.9172,
    longitude: 77.6228,
    severity_score: 0.94,
    action: 'ESCALATE',
    confidence: 0.76,
    auto_execute: false,
    reasoning: 'Critical multi-vehicle bottleneck on Hosur Main Road. Softmax confidence 76.4% triggers HITL Officer review.',
    status: 'PENDING',
    tool_calls_executed: [
      { tool: 'check_junction_cctv', result: { cctv_status: 'ONLINE', lane_blocked: true, breakdown_type: 'STALLED_BUS' } },
      { tool: 'query_available_units', result: { police_station: 'Madiwala', available_units_count: 3 } },
      { tool: 'calculate_shortest_route', result: { distance_km: 2.4, eta_mins: 7.2, path: ['Madiwala', 'Silk Board', 'HSR Layout'] } }
    ]
  },
  {
    ticket_id: 'CLUST_08',
    police_station: 'Upparpet',
    junction_name: 'Majestic Station Corridor',
    latitude: 12.9767,
    longitude: 77.5713,
    severity_score: 0.88,
    action: 'DISPATCH',
    confidence: 0.78,
    auto_execute: false,
    reasoning: 'Heavy illegal bus parking blocking CBD lane. Requires officer clearance approval.',
    status: 'PENDING',
    tool_calls_executed: [
      { tool: 'check_junction_cctv', result: { cctv_status: 'ONLINE', lane_blocked: true, breakdown_type: 'ILLEGAL_PARKING_CLUSTER' } },
      { tool: 'calculate_shortest_route', result: { distance_km: 3.1, eta_mins: 9.5, path: ['Upparpet', 'Majestic', 'Cubbon Park'] } }
    ]
  },
  {
    ticket_id: 'CLUST_22',
    police_station: 'Koramangala',
    junction_name: 'Sony World Junction',
    latitude: 12.9352,
    longitude: 77.6245,
    severity_score: 0.65,
    action: 'DISPATCH',
    confidence: 0.92,
    auto_execute: true,
    reasoning: 'High severity single-lane blockage. Auto-dispatched Heavy Tow Unit MAD_HEAV_01 via Dijkstra path.',
    status: 'AUTONOMOUS',
    tool_calls_executed: [
      { tool: 'query_available_units', result: { police_station: 'Koramangala', available_units_count: 2 } },
      { tool: 'issue_signal_override', result: { status: 'SUCCESS', override_mode: 'GREEN_CORRIDOR_PRIORITY' } }
    ]
  },
  {
    ticket_id: 'TICK_402',
    police_station: 'Indiranagar',
    junction_name: '100ft Road Corridor',
    latitude: 12.9784,
    longitude: 77.6408,
    severity_score: 0.42,
    action: 'VERIFY',
    confidence: 0.88,
    auto_execute: true,
    reasoning: 'Moderate severity double parking alert. Auto-issued CCTV visual inspection.',
    status: 'AUTONOMOUS',
    tool_calls_executed: [
      { tool: 'check_junction_cctv', result: { cctv_status: 'ONLINE', lane_blocked: false } }
    ]
  }
]

export default function App() {
  const [hourMin, setHourMin] = useState(0)
  const [hourMax, setHourMax] = useState(23)
  const [cascadeStage, setCascadeStage] = useState(4)
  const [flyToTarget, setFlyToTarget] = useState(null)
  const [simulatePin, setSimulatePin] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('HITL Queue')

  // Stage 4 RL & HITL States
  const [hitlModalOpen, setHitlModalOpen] = useState(false)
  const [activePrediction, setActivePrediction] = useState(null)
  const [rlMetrics, setRlMetrics] = useState(null)
  const [queueItems, setQueueItems] = useState(INITIAL_QUEUE_SEED)

  // Tow Truck Fleet & Animation State
  const [activeTrucks, setActiveTrucks] = useState([])
  const animFrameRef = useRef(null)

  // 15-Day Live Stream Simulation States
  const [streamStatus, setStreamStatus] = useState({
    running: true,
    speed: 10,
    index: 0,
    total_complaints: 450,
    day_number: 1,
    progress_pct: 0,
    simulated_now: null,
  })
  const [isProcessingInstant, setIsProcessingInstant] = useState(false)

  const { reports, heatmap, clusters, stats, timeline, loading, error } = useData(hourMin, hourMax, cascadeStage >= 1)

  useEffect(() => {
    fetchRlMetrics().then(data => setRlMetrics(data)).catch(() => {})
    fetchLiveStreamStatus().then(st => setStreamStatus(st)).catch(() => {})
  }, [])

  // Stream tick interval scales according to speed multiplier
  useEffect(() => {
    if (!streamStatus.running) return

    const pollIntervalMs = Math.max(1500, Math.floor(4000 / (streamStatus.speed || 10)))
    const interval = setInterval(async () => {
      try {
        const nextSt = await controlLiveStream({ action: 'next_step' })
        setStreamStatus(nextSt)
      } catch (e) {
        console.warn('Live stream tick error:', e)
      }
    }, pollIntervalMs)

    return () => clearInterval(interval)
  }, [streamStatus.running, streamStatus.speed])

  const handleToggleStreamPlay = useCallback(async () => {
    const nextSt = await controlLiveStream({ action: streamStatus.running ? 'pause' : 'play' })
    setStreamStatus(nextSt)
  }, [streamStatus.running])

  const handleResetStream = useCallback(async () => {
    const nextSt = await controlLiveStream({ action: 'reset' })
    setStreamStatus(nextSt)
  }, [])

  const handleChangeStreamSpeed = useCallback(async (newSpeed) => {
    const nextSt = await controlLiveStream({ speed: newSpeed })
    setStreamStatus(nextSt)
  }, [])

  // Auto-seed initial queue items from fetched DBSCAN clusters if available
  useEffect(() => {
    if (clusters && clusters.length > 0) {
      const clusterItems = clusters.slice(0, 4).map((c, idx) => ({
        ticket_id: `CLUST_${c.cluster_id}`,
        police_station: c.top_station || 'Madiwala',
        junction_name: `${c.top_station || 'Madiwala'} Junction`,
        latitude: c.latitude,
        longitude: c.longitude,
        severity_score: c.avg_severity || 0.75,
        action: c.avg_severity >= 0.85 ? 'ESCALATE' : c.avg_severity >= 0.55 ? 'DISPATCH' : 'VERIFY',
        confidence: c.avg_severity >= 0.85 ? 0.76 : 0.91,
        auto_execute: c.avg_severity < 0.85,
        reasoning: `DBSCAN Hotspot #${idx + 1} (${c.count} violations, radius ${c.radius_m.toFixed(0)}m). Qwen SOP evaluation.`,
        status: c.avg_severity >= 0.85 ? 'PENDING' : 'AUTONOMOUS',
        tool_calls_executed: [
          { tool: 'check_junction_cctv', result: { cctv_status: 'ONLINE', lane_blocked: c.avg_severity > 0.6 } },
          { tool: 'calculate_shortest_route', result: { distance_km: (2 + idx * 0.7).toFixed(1), eta_mins: (6 + idx * 2).toFixed(1), path: [c.top_station || 'Madiwala', 'Silk Board'] } }
        ]
      }))

      // Merge unique items into queue
      setQueueItems(prev => {
        const existingIds = new Set(prev.map(i => i.ticket_id))
        const newItems = clusterItems.filter(i => !existingIds.has(i.ticket_id))
        return [...prev, ...newItems]
      })
    }
  }, [clusters])

  // Continuous animation loop for active tow trucks moving along Dijkstra waypoints
  useEffect(() => {
    if (activeTrucks.length === 0) return

    const animate = () => {
      setActiveTrucks(prevTrucks => {
        return prevTrucks.map(truck => {
          if (truck.progress >= 1) {
            return { ...truck, status: 'ARRIVED', progress: 1 }
          }

          const newProgress = Math.min(1, truck.progress + 0.008) // step progress
          const path = truck.path_coords || []

          if (path.length > 0) {
            const indexFloat = newProgress * (path.length - 1)
            const currIdx = Math.floor(indexFloat)
            const nextIdx = Math.min(path.length - 1, currIdx + 1)
            const factor = indexFloat - currIdx

            const currPoint = path[currIdx]
            const nextPoint = path[nextIdx]

            const interpolatedLat = currPoint[0] + (nextPoint[0] - currPoint[0]) * factor
            const interpolatedLon = currPoint[1] + (nextPoint[1] - currPoint[1]) * factor

            return {
              ...truck,
              progress: newProgress,
              currentPos: { lat: interpolatedLat, lon: interpolatedLon },
              status: newProgress >= 1 ? 'ARRIVED' : 'EN ROUTE'
            }
          }
          return truck
        })
      })

      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [activeTrucks.length])

  // Dispatch Tow Truck Unit Function
  const handleDispatchTowTruck = useCallback((targetItem) => {
    const targetLat = targetItem.latitude || targetItem.lat || 12.9172
    const targetLon = targetItem.longitude || targetItem.lon || 77.6228
    const stationName = targetItem.police_station || 'Madiwala'
    const startCoords = STATION_COORDS[stationName] || [12.9255, 77.6186]

    // Generate Dijkstra road path waypoints
    const waypoints = generateDijkstraWaypoints(startCoords, [targetLat, targetLon], 25)

    const truckId = `TOW_${Date.now().toString().slice(-4)}`
    const newTruck = {
      id: truckId,
      unit_id: `${stationName.toUpperCase().slice(0, 3)}_HEAV_${Math.floor(Math.random() * 8 + 1).toString().padStart(2, '0')}`,
      unit_type: 'HEAVY_TOW_TRUCK',
      police_station: stationName,
      ticket_id: targetItem.ticket_id || 'Incident',
      startPos: { lat: startCoords[0], lon: startCoords[1] },
      targetPos: { lat: targetLat, lon: targetLon },
      currentPos: { lat: startCoords[0], lon: startCoords[1] },
      path_coords: waypoints,
      progress: 0,
      status: 'EN ROUTE',
      dist_km: 2.4,
      eta_mins: 7.2,
    }

    setActiveTrucks(prev => [...prev.filter(t => t.ticket_id !== newTruck.ticket_id), newTruck])
    setFlyToTarget({ lat: targetLat, lon: targetLon })
  }, [])

  // User requested function: Live Simulate Query Button Trigger
  const handleTriggerInstantLiveQuery = useCallback(async () => {
    setIsProcessingInstant(true)
    try {
      const liveRes = await triggerInstantLiveQuery()
      if (liveRes) {
        const newItem = {
          ticket_id: liveRes.ticket_id || `LIVE_${Date.now()}`,
          police_station: liveRes.police_station || 'Madiwala',
          junction_name: liveRes.junction_name || 'Silk Board Junction',
          latitude: liveRes.latitude,
          longitude: liveRes.longitude,
          severity_score: liveRes.severity_score || 0.85,
          action: liveRes.action || 'DISPATCH',
          confidence: liveRes.confidence || 0.88,
          auto_execute: liveRes.auto_execute !== undefined ? liveRes.auto_execute : true,
          reasoning: liveRes.reasoning || 'Live complaint received and handled instantly by Qwen 2.5 SOP pipeline.',
          status: (!liveRes.auto_execute || liveRes.action === 'ESCALATE') ? 'PENDING' : 'AUTONOMOUS',
          tool_calls_executed: liveRes.tool_calls_executed || [],
        }

        // Add to top of queue
        setQueueItems(prev => [newItem, ...prev])
        setActivePrediction(newItem)

        // Fly map view directly to incident spot
        if (newItem.latitude && newItem.longitude) {
          setFlyToTarget({ lat: newItem.latitude, lon: newItem.longitude })
        }

        // Trigger heavy tow truck dispatch or open HITL modal
        if (newItem.action === 'DISPATCH') {
          handleDispatchTowTruck(newItem)
        } else if (newItem.action === 'ESCALATE' || !newItem.auto_execute) {
          setHitlModalOpen(true)
        }
      }

      const updatedSt = await fetchLiveStreamStatus()
      setStreamStatus(updatedSt)
    } catch (err) {
      console.error('Instant live query simulation failed:', err)
    } finally {
      setIsProcessingInstant(false)
    }
  }, [handleDispatchTowTruck])

  const handleRangeChange = useCallback((min, max) => {
    setHourMin(min)
    setHourMax(max)
  }, [])

  // Trigger Stage 4 RL SOP Evaluation on hotspot click
  const handleHotspotClick = useCallback(async (cluster) => {
    setFlyToTarget({ lat: cluster.latitude, lon: cluster.longitude })

    try {
      const pred = await predictAction({
        ticket_id: `CLUST_${cluster.cluster_id}`,
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        police_station: cluster.top_station || 'Madiwala',
        junction_name: `${cluster.top_station || 'Madiwala'} Junction`,
        severity_score: cluster.avg_severity || 0.75,
        report_count: cluster.count || 5
      })
      setActivePrediction(pred)

      // Append/Update queue item
      setQueueItems(prev => {
        const itemIndex = prev.findIndex(i => i.ticket_id === pred.ticket_id)
        const newItem = {
          ...pred,
          latitude: cluster.latitude,
          longitude: cluster.longitude,
          police_station: cluster.top_station || 'Madiwala',
          junction_name: `${cluster.top_station || 'Madiwala'} Junction`,
          status: (!pred.auto_execute || pred.action === 'ESCALATE') ? 'PENDING' : 'AUTONOMOUS'
        }
        if (itemIndex >= 0) {
          const updated = [...prev]
          updated[itemIndex] = newItem
          return updated
        }
        return [newItem, ...prev]
      })

      if (!pred.auto_execute || pred.action === 'ESCALATE') {
        setHitlModalOpen(true)
      } else if (pred.action === 'DISPATCH') {
        handleDispatchTowTruck(pred)
      }
    } catch (err) {
      console.error('RL Action Prediction failed:', err)
    }
  }, [handleDispatchTowTruck])

  // Handle Simulation
  const handleSimulateResult = useCallback(async (pin) => {
    setSimulatePin(pin)
    setFlyToTarget({ lat: pin.lat, lon: pin.lon })

    try {
      const ticketId = `SIM_${Date.now().toString().slice(-4)}`
      const pred = await predictAction({
        ticket_id: ticketId,
        latitude: pin.lat,
        longitude: pin.lon,
        police_station: 'Madiwala',
        junction_name: pin.junction_name || 'Silk Board Junction',
        severity_score: pin.severity || 0.75,
        report_count: 1
      })

      const newItem = {
        ...pred,
        latitude: pin.lat,
        longitude: pin.lon,
        police_station: 'Madiwala',
        junction_name: pin.junction_name || 'Silk Board Junction',
        status: (!pred.auto_execute || pred.action === 'ESCALATE') ? 'PENDING' : 'AUTONOMOUS'
      }

      setActivePrediction(newItem)
      setQueueItems(prev => [newItem, ...prev])

      if (!pred.auto_execute || pred.action === 'ESCALATE') {
        setHitlModalOpen(true)
      } else if (pred.action === 'DISPATCH') {
        handleDispatchTowTruck(newItem)
      }
    } catch (err) {
      console.error('RL Prediction failed on simulation:', err)
    }
  }, [handleDispatchTowTruck])

  // Selecting item from queue
  const handleSelectQueueItem = (item) => {
    setActivePrediction(item)
    if (item.latitude && item.longitude) {
      setFlyToTarget({ lat: item.latitude, lon: item.longitude })
    }
    if (!item.auto_execute || item.action === 'ESCALATE' || item.status === 'PENDING') {
      setHitlModalOpen(true)
    }
  }

  // Quick Approve item in queue
  const handleApproveQueueItem = async (item) => {
    await postHumanFeedback({
      ticket_id: item.ticket_id,
      original_action: item.action,
      officer_action: item.action,
      is_approved: true,
      officer_notes: 'Quick approved from HITL Queue',
      incident_state: { severity_score: item.severity_score, assigned_unit: item.assigned_unit }
    })

    setQueueItems(prev => prev.map(i => i.ticket_id === item.ticket_id ? { ...i, status: 'APPROVED', auto_execute: true } : i))

    if (item.action === 'DISPATCH' || item.action === 'ESCALATE') {
      handleDispatchTowTruck(item)
    }

    const updatedMetrics = await fetchRlMetrics()
    setRlMetrics(updatedMetrics)
  }

  const handleHumanFeedbackSubmit = async (feedbackData) => {
    await postHumanFeedback(feedbackData)
    setQueueItems(prev => prev.map(i => i.ticket_id === feedbackData.ticket_id ? {
      ...i,
      status: feedbackData.is_approved ? 'APPROVED' : 'OVERRIDDEN',
      officer_action: feedbackData.officer_action
    } : i))

    const updated = await fetchRlMetrics()
    setRlMetrics(updated)
  }

  const pendingHitlCount = queueItems.filter(i => !i.auto_execute || i.action === 'ESCALATE' || i.status === 'PENDING').length

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
          h-screen w-[360px] shrink-0
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
          queueItems={queueItems}
          onSelectQueueItem={handleSelectQueueItem}
          onApproveAction={handleApproveQueueItem}
          onDispatchTowTruck={handleDispatchTowTruck}
          rlMetrics={rlMetrics}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
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

        {/* ── Top Navbar ── */}
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

            {/* Qwen Status Badge */}
            <div className="flex items-center gap-2 rounded-full bg-bg-canvas border border-bg-border px-3 py-1.5 shrink-0">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-text-primary hidden sm:inline">
                Qwen 2.5 0.5B RL SOP
              </span>
              <span className="text-xs font-bold text-text-primary sm:hidden">
                Qwen SOP
              </span>
            </div>

            {/* Stage Cascade Toggles */}
            <div className="hidden lg:flex items-center gap-1 bg-bg-canvas border border-bg-border rounded-lg p-1">
              {stageLabels.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => setCascadeStage(stage.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    cascadeStage >= stage.id
                      ? 'bg-accent-blue/15 text-accent-blue'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  {stage.label}
                </button>
              ))}
            </div>

            {loading && <div className="spinner shrink-0" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />}
          </div>

          {/* Right — HITL Queue Badge, Tow Truck Count, Clock, Theme */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Prominent HITL Review Queue Launcher Button */}
            <button
              onClick={() => {
                setActiveTab('HITL Queue')
                setSidebarOpen(true)
              }}
              className={`relative px-3 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all shadow-md ${
                pendingHitlCount > 0
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-bg-canvas text-text-secondary border-bg-border hover:bg-bg-hover'
              }`}
            >
              <ShieldAlert size={16} className={pendingHitlCount > 0 ? 'animate-pulse text-amber-400' : ''} />
              <span className="hidden sm:inline">HITL Review Queue</span>
              {pendingHitlCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-mono font-extrabold text-[10px]">
                  {pendingHitlCount}
                </span>
              )}
            </button>

            {/* Active Tow Trucks counter pill */}
            {activeTrucks.length > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                <Truck size={15} className="animate-bounce" />
                <span>{activeTrucks.length} Tow Units Active</span>
              </div>
            )}

            <LiveClock />
            <ThemeToggle />

            <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-bg-border">
              <div className="w-8 h-8 rounded-full bg-accent-blue/15 flex items-center justify-center">
                <span className="text-xs font-bold text-accent-blue">TC</span>
              </div>
              <span className="text-sm font-semibold text-text-primary">Officer</span>
            </div>
          </div>
        </header>

        {/* ── 15-Day Live Complaints Streaming Bar ── */}
        <LiveStreamBar
          streamStatus={streamStatus}
          onTogglePlay={handleToggleStreamPlay}
          onReset={handleResetStream}
          onChangeSpeed={handleChangeStreamSpeed}
          onTriggerInstantQuery={handleTriggerInstantLiveQuery}
          isProcessingInstant={isProcessingInstant}
        />

        {/* ── Main Content Area ── */}
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
              activeTrucks={activeTrucks}
            />

            {/* Map Legend */}
            <div className="absolute bottom-4 right-4 z-10 bg-bg-card/90 border border-bg-border rounded-xl p-3 text-xs space-y-1.5 backdrop-blur-md hidden sm:block shadow-xl">
              <div className="text-text-muted font-bold mb-1.5 text-[10px] uppercase tracking-widest">
                Map Layers & Units
              </div>
              {[
                { token: 'bg-emerald-500', label: 'Low Risk (0-25%)' },
                { token: 'bg-amber-500', label: 'Moderate Risk (25-50%)' },
                { token: 'bg-rose-500', label: 'High / Critical (50-100%)' },
                { token: 'bg-amber-400 border border-white', label: 'Heavy Tow Truck Unit' },
              ].map(({ token, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${token}`} />
                  <span className="text-text-secondary text-[11px] font-medium">{label}</span>
                </div>
              ))}
            </div>

            {/* Live Agentic Tool Execution Log Overlay */}
            {activePrediction && activePrediction.tool_calls_executed && (
              <div className="absolute bottom-4 left-4 z-10 max-w-sm w-full hidden lg:block">
                <ToolExecutionLog
                  toolCalls={activePrediction.tool_calls_executed}
                  metrics={rlMetrics}
                  onClose={() => setActivePrediction(null)}
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
        onDispatchTowTruck={handleDispatchTowTruck}
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
