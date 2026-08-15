import { useState, useEffect, useCallback } from 'react'
import { fetchReports, fetchHeatmap, fetchClusters, fetchStats, fetchTimeline } from '../api'

function getFilterParams(filters) {
  const params = {
    hour_min: filters.hourMin ?? 0,
    hour_max: filters.hourMax ?? 23,
    approved_only: true,
    limit: 3000,
  }

  // Severity mapping
  if (filters.severityRange === 'CRITICAL') {
    params.severity_min = 0.75
    params.severity_max = 1.0
  } else if (filters.severityRange === 'HIGH') {
    params.severity_min = 0.50
    params.severity_max = 1.0
  } else if (filters.severityRange === 'MODERATE') {
    params.severity_min = 0.25
    params.severity_max = 0.50
  } else if (filters.severityRange === 'LOW') {
    params.severity_min = 0.0
    params.severity_max = 0.25
  }

  // Vehicle mapping
  if (filters.vehicleType && filters.vehicleType !== 'ALL') {
    params.vehicle_type = filters.vehicleType
  }

  // Date range mapping
  const dr = filters.dateRange
  if (dr === 'LAST_30') {
    params.start_date = '2024-03-09'
    params.end_date = '2024-04-08'
  } else if (dr === 'LAST_15') {
    params.start_date = '2024-03-24'
    params.end_date = '2024-04-08'
  } else if (dr === 'NOV_2023') {
    params.start_date = '2023-11-01'
    params.end_date = '2023-11-30'
  } else if (dr === 'DEC_2023') {
    params.start_date = '2023-12-01'
    params.end_date = '2023-12-31'
  } else if (dr === 'JAN_2024') {
    params.start_date = '2024-01-01'
    params.end_date = '2024-01-31'
  } else if (dr === 'FEB_2024') {
    params.start_date = '2024-02-01'
    params.end_date = '2024-02-29'
  } else if (dr === 'MAR_2024') {
    params.start_date = '2024-03-01'
    params.end_date = '2024-03-31'
  } else if (dr === 'APR_2024') {
    params.start_date = '2024-04-01'
    params.end_date = '2024-04-30'
  }

  return params
}

export function useData({ filters = {}, viewMode = 'LIVE', dayNumber = 1, cascadeStage = 4 } = {}) {
  const [reports, setReports] = useState([])
  const [heatmap, setHeatmap] = useState([])
  const [clusters, setClusters] = useState([])
  const [stats, setStats] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(() => {
    setLoading(true)

    let reportParams = {}
    let statsParams = {}
    let clusterParams = {}
    let timelineParams = {}

    if (viewMode === 'LIVE') {
      reportParams = {
        day_number: dayNumber,
        approved_only: cascadeStage >= 1,
        limit: 3000,
      }
      statsParams = { day_number: dayNumber }
      clusterParams = { day_number: dayNumber }
      timelineParams = { day_number: dayNumber }
    } else {
      const historicalParams = getFilterParams(filters)
      reportParams = {
        ...historicalParams,
        approved_only: cascadeStage >= 1,
      }
      statsParams = historicalParams
      clusterParams = {
        start_date: historicalParams.start_date,
        end_date: historicalParams.end_date,
      }
      timelineParams = {
        start_date: historicalParams.start_date,
        end_date: historicalParams.end_date,
      }
    }

    Promise.all([
      fetchReports(reportParams),
      fetchHeatmap(reportParams),
      fetchClusters(clusterParams),
      fetchStats(statsParams),
      fetchTimeline(timelineParams),
    ])
      .then(([r, h, c, s, t]) => {
        setReports(r || [])
        setHeatmap(h || [])
        setClusters(c || [])
        setStats(s || null)
        setTimeline(t || [])
        setLoading(false)
        setError(null)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [viewMode, dayNumber, cascadeStage, JSON.stringify(filters)])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { reports, heatmap, clusters, stats, timeline, loading, error, refetch: fetchData }
}
