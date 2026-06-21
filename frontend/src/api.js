import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' },
})

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

export const fetchClusters = () =>
  withFallback(api.get('/api/clusters'), '/fallback/clusters.json')

export const fetchStats = () =>
  withFallback(api.get('/api/stats'), '/fallback/stats.json')

export const fetchTimeline = () =>
  withFallback(api.get('/api/timeline'), '/fallback/timeline.json')

export const postSimulate = async (body) => {
  // Try backend first; if it fails, throw error as we can't reliably mock inference
  const res = await api.post('/api/simulate', body)
  return res.data
}

export default api
