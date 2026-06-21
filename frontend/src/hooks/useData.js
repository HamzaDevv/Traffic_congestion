import { useState, useEffect, useCallback } from 'react'
import { fetchReports, fetchHeatmap, fetchClusters, fetchStats, fetchTimeline } from '../api'

export function useData(hourMin = 0, hourMax = 23, approvedOnly = true) {
  const [reports, setReports] = useState([])
  const [heatmap, setHeatmap] = useState([])
  const [clusters, setClusters] = useState([])
  const [stats, setStats] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch static data once
  useEffect(() => {
    Promise.all([fetchClusters(), fetchStats(), fetchTimeline()])
      .then(([c, s, t]) => {
        setClusters(c)
        setStats(s)
        setTimeline(t)
      })
      .catch(err => setError(err.message))
  }, [])

  // Re-fetch filtered data when time range changes
  const fetchFiltered = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetchReports({ hour_min: hourMin, hour_max: hourMax, approved_only: approvedOnly, limit: 3000 }),
      fetchHeatmap({ hour_min: hourMin, hour_max: hourMax }),
    ])
      .then(([r, h]) => {
        setReports(r)
        setHeatmap(h)
        setLoading(false)
        setError(null)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [hourMin, hourMax, approvedOnly])

  useEffect(() => {
    fetchFiltered()
  }, [fetchFiltered])

  return { reports, heatmap, clusters, stats, timeline, loading, error }
}
