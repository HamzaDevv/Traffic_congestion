import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchReports, fetchHeatmap, fetchClusters, fetchStats, fetchTimeline } from '../api'

function getFilterParams(filters) {
  const params = {
    hour_min: filters?.hourMin ?? 0,
    hour_max: filters?.hourMax ?? 23,
    approved_only: true,
    limit: 5000,
  }

  if (filters?.severityRange === 'CRITICAL') {
    params.severity_min = 0.75
    params.severity_max = 1.0
  } else if (filters?.severityRange === 'HIGH') {
    params.severity_min = 0.50
    params.severity_max = 1.0
  } else if (filters?.severityRange === 'MODERATE') {
    params.severity_min = 0.25
    params.severity_max = 0.50
  } else if (filters?.severityRange === 'LOW') {
    params.severity_min = 0.0
    params.severity_max = 0.25
  }

  if (filters?.vehicleType && filters?.vehicleType !== 'ALL') {
    params.vehicle_type = filters.vehicleType
  }

  const dr = filters?.dateRange
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

// Compute client-side statistics dynamically from records
function computeClientStats(records = [], clusters = []) {
  if (!records || records.length === 0) {
    return {
      total_reports: 0,
      approved_count: 0,
      approval_rate: 0,
      avg_severity: 0,
      num_clusters: clusters.length,
      peak_hour: 18,
      active_complaints_1h: 0,
      m1_loaded: true,
      m2_loaded: true,
      top_stations: [],
      vehicle_breakdown: [],
    }
  }

  const approved = records.filter(r => r.is_approved === 1 || r.is_approved === true)
  const approvedCount = approved.length
  const approvalRate = records.length > 0 ? (approvedCount / records.length) * 100 : 0

  const avgSeverity = approved.length > 0
    ? approved.reduce((sum, r) => sum + (Number(r.severity_score) || 0), 0) / approved.length
    : 0

  const hourCounts = {}
  records.forEach(r => {
    const h = Number(r.hour) || 0
    hourCounts[h] = (hourCounts[h] || 0) + 1
  })
  let peakHour = 18
  let peakCount = 0
  Object.entries(hourCounts).forEach(([h, count]) => {
    if (count > peakCount) {
      peakCount = count
      peakHour = Number(h)
    }
  })

  const stationStats = {}
  approved.forEach(r => {
    const st = r.police_station || 'Unknown'
    if (!stationStats[st]) stationStats[st] = { station: st, violations: 0, sumSev: 0 }
    stationStats[st].violations += 1
    stationStats[st].sumSev += Number(r.severity_score) || 0
  })
  const topStations = Object.values(stationStats)
    .map(s => ({
      station: s.station,
      violations: s.violations,
      avg_severity: s.violations > 0 ? s.sumSev / s.violations : 0
    }))
    .sort((a, b) => b.violations - a.violations)
    .slice(0, 10)

  const vehCounts = {}
  approved.forEach(r => {
    const v = r.vehicle_type || 'Unknown'
    vehCounts[v] = (vehCounts[v] || 0) + 1
  })
  const vehicleBreakdown = Object.entries(vehCounts)
    .map(([vehicle_type, count]) => ({ vehicle_type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return {
    total_reports: records.length,
    approved_count: approvedCount,
    approval_rate: Number(approvalRate.toFixed(1)),
    avg_severity: Number(avgSeverity.toFixed(3)),
    num_clusters: clusters.length,
    peak_hour: peakHour,
    active_complaints_1h: peakCount || Math.max(1, Math.floor(records.length * 0.15)),
    m1_loaded: true,
    m2_loaded: true,
    top_stations: topStations,
    vehicle_breakdown: vehicleBreakdown,
  }
}

// Compute client-side 24-hour timeline from records
function computeClientTimeline(records = []) {
  const counts = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, sumSev: 0 }))
  records.forEach(r => {
    const h = Number(r.hour)
    if (h >= 0 && h < 24) {
      counts[h].count += 1
      counts[h].sumSev += Number(r.severity_score) || 0
    }
  })
  return counts.map(c => ({
    hour: c.hour,
    count: c.count,
    avg_severity: c.count > 0 ? Number((c.sumSev / c.count).toFixed(3)) : 0
  }))
}

// Compute clusters for day or filtered slice
function computeClientClusters(records = []) {
  const approved = records.filter(r => (r.is_approved === 1 || r.is_approved === true) && r.latitude && r.longitude)
  if (approved.length === 0) return []

  const stationMap = {}
  approved.forEach(r => {
    const st = r.police_station || 'Unknown'
    if (!stationMap[st]) stationMap[st] = { station: st, items: [] }
    stationMap[st].items.push(r)
  })

  const clusters = []
  Object.values(stationMap)
    .sort((a, b) => b.items.length - a.items.length)
    .slice(0, 15)
    .forEach((stGroup, idx) => {
      const items = stGroup.items
      const avgLat = items.reduce((s, i) => s + Number(i.latitude), 0) / items.length
      const avgLon = items.reduce((s, i) => s + Number(i.longitude), 0) / items.length
      const avgSev = items.reduce((s, i) => s + (Number(i.severity_score) || 0), 0) / items.length

      clusters.push({
        cluster_id: idx + 1,
        latitude: avgLat,
        longitude: avgLon,
        count: items.length,
        avg_severity: Number(avgSev.toFixed(3)),
        top_station: stGroup.station,
        radius_m: Math.min(600, Math.max(150, items.length * 40)),
      })
    })

  return clusters
}

// Client-side filtering
function filterClientRecords(records = [], { viewMode, dayNumber, cascadeStage, filters }) {
  if (!records || records.length === 0) return []

  let filtered = [...records]

  if (viewMode === 'LIVE') {
    const targetDay = Number(dayNumber) || 1
    filtered = filtered.filter(r => {
      if (r.day_number !== undefined && r.day_number !== null) {
        return Number(r.day_number) === targetDay
      }
      if (r.created_datetime) {
        const dt = new Date(r.created_datetime)
        const cutoff = new Date('2024-03-24T08:14:46Z')
        const diffDays = Math.floor((dt - cutoff) / (1000 * 60 * 60 * 24)) + 1
        return diffDays === targetDay
      }
      return true
    })

    if (cascadeStage >= 1) {
      filtered = filtered.filter(r => r.is_approved === 1 || r.is_approved === true)
    }
  } else {
    const { hourMin = 0, hourMax = 23, severityRange = 'ALL', vehicleType = 'ALL', dateRange = 'ALL' } = filters || {}

    filtered = filtered.filter(r => {
      const h = Number(r.hour)
      return h >= hourMin && h <= hourMax
    })

    if (severityRange === 'CRITICAL') {
      filtered = filtered.filter(r => Number(r.severity_score) >= 0.75)
    } else if (severityRange === 'HIGH') {
      filtered = filtered.filter(r => Number(r.severity_score) >= 0.50)
    } else if (severityRange === 'MODERATE') {
      filtered = filtered.filter(r => Number(r.severity_score) >= 0.25 && Number(r.severity_score) < 0.50)
    } else if (severityRange === 'LOW') {
      filtered = filtered.filter(r => Number(r.severity_score) < 0.25)
    }

    if (vehicleType && vehicleType !== 'ALL') {
      filtered = filtered.filter(r => (r.vehicle_type || '').toUpperCase().includes(vehicleType.toUpperCase()))
    }

    if (dateRange && dateRange !== 'ALL') {
      filtered = filtered.filter(r => {
        if (!r.created_datetime) return true
        const dtStr = String(r.created_datetime)
        if (dateRange === 'NOV_2023') return dtStr.startsWith('2023-11')
        if (dateRange === 'DEC_2023') return dtStr.startsWith('2023-12')
        if (dateRange === 'JAN_2024') return dtStr.startsWith('2024-01')
        if (dateRange === 'FEB_2024') return dtStr.startsWith('2024-02')
        if (dateRange === 'MAR_2024') return dtStr.startsWith('2024-03')
        if (dateRange === 'APR_2024') return dtStr.startsWith('2024-04')
        if (dateRange === 'LAST_30') return dtStr >= '2024-03-09'
        if (dateRange === 'LAST_15') return dtStr >= '2024-03-24'
        return true
      })
    }

    if (cascadeStage >= 1) {
      filtered = filtered.filter(r => r.is_approved === 1 || r.is_approved === true)
    }
  }

  return filtered
}

export function useData({ filters = {}, viewMode = 'LIVE', dayNumber = 1, cascadeStage = 4 } = {}) {
  const [rawDataset, setRawDataset] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Initial fetch of dataset (from API or fallback)
  useEffect(() => {
    setLoading(true)
    fetchReports({ approved_only: false, limit: 5000 })
      .then(res => {
        if (Array.isArray(res) && res.length > 0) {
          setRawDataset(res)
        }
        setLoading(false)
        setError(null)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // Dynamic calculation for current mode, day, stage, and filters
  const { reports, heatmap, clusters, stats, timeline } = useMemo(() => {
    if (!rawDataset || rawDataset.length === 0) {
      return {
        reports: [],
        heatmap: [],
        clusters: [],
        stats: null,
        timeline: [],
      }
    }

    // Filter records for current view mode and parameters
    const filtered = filterClientRecords(rawDataset, {
      viewMode,
      dayNumber,
      cascadeStage,
      filters,
    })

    // Also get all-stage records for the day/filter (to compute stats accurately)
    const baseDayRecords = filterClientRecords(rawDataset, {
      viewMode,
      dayNumber,
      cascadeStage: 0, // include all reports for stats calculation
      filters,
    })

    const dailyClusters = computeClientClusters(baseDayRecords)
    const dynamicStats = computeClientStats(baseDayRecords, dailyClusters)
    const dynamicTimeline = computeClientTimeline(baseDayRecords)

    const dynamicHeatmap = filtered
      .filter(r => r.latitude && r.longitude)
      .map(r => [
        Number(r.latitude),
        Number(r.longitude),
        Number(r.severity_score) || 0.5,
      ])

    return {
      reports: filtered,
      heatmap: dynamicHeatmap,
      clusters: dailyClusters,
      stats: dynamicStats,
      timeline: dynamicTimeline,
    }
  }, [rawDataset, viewMode, dayNumber, cascadeStage, JSON.stringify(filters)])

  return {
    reports,
    heatmap,
    clusters,
    stats,
    timeline,
    loading,
    error,
    totalRawCount: rawDataset.length,
  }
}
