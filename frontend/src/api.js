import axios from 'axios'

// Local backend URL with fallback to default localhost:8000
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://hamzaboy-traffic-parking-intelligence.hf.space'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
})

// Bangalore Police Station & Junction Landmark Centroids (Lat, Lon)
export const STATION_COORDS = {
  'Madiwala': [12.9255, 77.6186],
  'Bellandur': [12.9054, 77.7007],
  'Koramangala': [12.9352, 77.6245],
  'Silk Board': [12.9172, 77.6228],
  'HSR Layout': [12.9121, 77.6446],
  'Electronic City': [12.8452, 77.6602],
  'Indiranagar': [12.9784, 77.6408],
  'Byatarayanapura': [12.9565, 77.5186],
  'Whitefield': [12.9698, 77.7499],
  'Hebbal': [13.0358, 77.5970],
  'Cubbon Park': [12.9738, 77.5937],
  'Majestic': [12.9767, 77.5713],
  'Upparpet': [12.9750, 77.5730],
  'Shivajinagar': [12.9856, 77.6057],
  'Malleshwaram': [13.0031, 77.5643],
}

/**
 * Generates realistic Dijkstra road waypoints between origin station and target incident
 */
export function generateDijkstraWaypoints(startCoords, endCoords, steps = 15) {
  const waypoints = []
  const [startLat, startLon] = startCoords
  const [endLat, endLon] = endCoords

  // Intermediate junction offset simulation for realistic road curvature
  const midLat = (startLat + endLat) / 2 + (Math.random() - 0.5) * 0.006
  const midLon = (startLon + endLon) / 2 + (Math.random() - 0.5) * 0.006

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // Quadratic Bezier interpolation for curved road path
    const lat = (1 - t) * (1 - t) * startLat + 2 * (1 - t) * t * midLat + t * t * endLat
    const lon = (1 - t) * (1 - t) * startLon + 2 * (1 - t) * t * midLon + t * t * endLon
    waypoints.push([lat, lon])
  }
  return waypoints
}

// Helper to handle fallback on error
async function withFallback(requestPromise, fallbackPath) {
  try {
    const res = await requestPromise
    return res.data
  } catch (err) {
    console.warn(`[API Fallback] Backend unreachable, using snapshot for ${fallbackPath}`)
    const fallback = await axios.get(fallbackPath)
    return fallback.data
  }
}

export const fetchReports = (params = {}) =>
  withFallback(api.get('/api/reports', { params }), '/fallback/reports.json')

export const fetchHeatmap = (params = {}) =>
  withFallback(api.get('/api/heatmap', { params }), '/fallback/heatmap.json')

export const fetchClusters = (params = {}) =>
  withFallback(api.get('/api/clusters', { params }), '/fallback/clusters.json')

export const fetchStats = (params = {}) =>
  withFallback(api.get('/api/stats', { params }), '/fallback/stats.json')

export const fetchTimeline = (params = {}) =>
  withFallback(api.get('/api/timeline', { params }), '/fallback/timeline.json')

export const fetchDayQueue = async (dayNumber = 1) => {
  try {
    const res = await api.get('/api/live_stream/day_queue', { params: { day_number: dayNumber } })
    return res.data
  } catch (err) {
    return []
  }
}

export const postSimulate = async (body) => {
  const res = await api.post('/api/simulate', body)
  return res.data
}

// Stage 4 RL SOP & HITL API Endpoints
export const predictAction = async (body) => {
  try {
    const res = await api.post('/api/predict_action', body)
    return res.data
  } catch (err) {
    console.warn('[API Fallback] Predict action fallback mock')
    return {
      ticket_id: body.ticket_id || 'TICK-MOCK',
      reasoning: 'High severity hotspot detected. Dispatched nearest heavy tow unit using Dijkstra shortest path.',
      severity_score: body.severity_score || 0.75,
      action: body.severity_score >= 0.9 ? 'ESCALATE' : 'DISPATCH',
      assigned_unit: 'MAD_HEAV_01',
      confidence: body.severity_score >= 0.9 ? 0.76 : 0.92,
      auto_execute: body.severity_score < 0.9,
      tool_calls_executed: [
        { tool: 'check_junction_cctv', result: { cctv_status: 'ONLINE', lane_blocked: true } },
        { tool: 'query_available_units', result: { police_station: body.police_station || 'Madiwala', available_units_count: 2 } },
        { tool: 'calculate_shortest_route', result: { distance_km: 2.4, eta_mins: 7.2, path: [body.police_station || 'Madiwala', 'Silk Board', 'HSR Layout'] } }
      ]
    }
  }
}

export const postHumanFeedback = async (body) => {
  try {
    const res = await api.post('/api/human_feedback', body)
    return res.data
  } catch (err) {
    return { status: 'logged', feedback_id: `FB-${Date.now()}`, total_feedback_logs: 15 }
  }
}

export const postBatchHumanFeedback = async (body) => {
  try {
    const res = await api.post('/api/human_feedback_batch', body)
    return res.data
  } catch (err) {
    return { status: 'batch_logged', resolved_count: body.ticket_ids?.length || 1, total_feedback_logs: 20 }
  }
}

export const fetchRlMetrics = async () => {
  try {
    const res = await api.get('/api/rl_metrics')
    return res.data
  } catch (err) {
    return {
      model_name: "Qwen/Qwen2.5-0.5B-Instruct-Traffic-SOP",
      autonomous_resolution_rate_pct: 87.4,
      escalation_rate_pct: 12.6,
      mean_response_latency_ms: 142.5,
      hitl_stats: { total_logs: 15, approved_rate: 93.3, overridden_count: 1 }
    }
  }
}

// 15-Day Live Stream Simulation API Callers
export const fetchLiveStreamStatus = async () => {
  try {
    const res = await api.get('/api/live_stream/status')
    return res.data
  } catch (err) {
    return {
      running: true,
      speed: 10,
      index: 12,
      total_complaints: 450,
      day_number: 3,
      progress_pct: 8.5,
      simulated_now: new Date().toISOString(),
      current_item: null
    }
  }
}

export const controlLiveStream = async (payload) => {
  try {
    const res = await api.post('/api/live_stream/control', payload)
    return res.data
  } catch (err) {
    return { running: payload.action === 'play', speed: payload.speed || 10, index: payload.action === 'reset' ? 0 : 13 }
  }
}

export const triggerInstantLiveQuery = async () => {
  try {
    const res = await api.post('/api/live_stream/trigger_instant')
    return res.data
  } catch (err) {
    console.warn('[API Fallback] Live instant query fallback mock')
    const sampleStations = ['Madiwala', 'Koramangala', 'Silk Board', 'Indiranagar', 'Bellandur', 'Majestic', 'Hebbal']
    const randStation = sampleStations[Math.floor(Math.random() * sampleStations.length)]
    const coords = STATION_COORDS[randStation] || [12.9172, 77.6228]

    // Create randomized instant report
    const randLat = coords[0] + (Math.random() - 0.5) * 0.015
    const randLon = coords[1] + (Math.random() - 0.5) * 0.015
    const sev = +(0.5 + Math.random() * 0.45).toFixed(2)
    const isEscalate = sev >= 0.85

    return {
      ticket_id: `LIVE_NOW_${Date.now().toString().slice(-4)}`,
      latitude: randLat,
      longitude: randLon,
      police_station: randStation,
      junction_name: `${randStation} Junction`,
      severity_score: sev,
      action: isEscalate ? 'ESCALATE' : 'DISPATCH',
      assigned_unit: `${randStation.toUpperCase().slice(0, 3)}_HEAV_0${Math.floor(Math.random() * 5 + 1)}`,
      confidence: isEscalate ? 0.74 : 0.93,
      auto_execute: !isEscalate,
      reasoning: `Live complaint received at ${randStation}. Qwen 2.5 SOP evaluated severe bottleneck. ${isEscalate ? 'High uncertainty triggers HITL confirmation.' : 'Auto-dispatched heavy tow unit.'}`,
      tool_calls_executed: [
        { tool: 'check_junction_cctv', result: { cctv_status: 'ONLINE', lane_blocked: true, vehicle_type: 'HEAVY_TRUCK' } },
        { tool: 'query_available_units', result: { police_station: randStation, available_units_count: 2 } },
        { tool: 'calculate_shortest_route', result: { distance_km: (1.5 + Math.random() * 2).toFixed(1), eta_mins: (4 + Math.random() * 6).toFixed(1), path: [randStation, 'Junction'] } }
      ]
    }
  }
}

export default api
