import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

export const fetchReports = (params = {}) =>
  api.get('/api/reports', { params }).then(r => r.data)

export const fetchHeatmap = (params = {}) =>
  api.get('/api/heatmap', { params }).then(r => r.data)

export const fetchClusters = () =>
  api.get('/api/clusters').then(r => r.data)

export const fetchStats = () =>
  api.get('/api/stats').then(r => r.data)

export const fetchTimeline = () =>
  api.get('/api/timeline').then(r => r.data)

export const postSimulate = (body) =>
  api.post('/api/simulate', body).then(r => r.data)

export default api
