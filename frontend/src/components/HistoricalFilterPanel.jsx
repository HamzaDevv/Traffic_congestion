import React from 'react'
import { Calendar, Clock, Filter, Layers, ShieldAlert, Truck, X, RotateCcw } from 'lucide-react'

export default function HistoricalFilterPanel({
  filters,
  onChangeFilters,
  onResetFilters,
  totalMatchingReports = 0,
  onClose
}) {
  const {
    dateRange = 'ALL',
    hourMin = 0,
    hourMax = 23,
    severityRange = 'ALL',
    vehicleType = 'ALL',
    showHeatmap = true,
  } = filters || {}

  const datePresets = [
    { id: 'ALL', label: 'All 5 Months (Nov 23 - Apr 24)' },
    { id: 'LAST_30', label: 'Last 30 Days' },
    { id: 'LAST_15', label: 'Last 15 Days' },
    { id: 'NOV_2023', label: 'Nov 2023' },
    { id: 'DEC_2023', label: 'Dec 2023' },
    { id: 'JAN_2024', label: 'Jan 2024' },
    { id: 'FEB_2024', label: 'Feb 2024' },
    { id: 'MAR_2024', label: 'Mar 2024' },
    { id: 'APR_2024', label: 'Apr 2024' },
  ]

  const severityPresets = [
    { id: 'ALL', label: 'All Severity Levels' },
    { id: 'CRITICAL', label: 'Critical (>75%)', color: 'text-rose-400 border-rose-500/30' },
    { id: 'HIGH', label: 'High (>50%)', color: 'text-amber-400 border-amber-500/30' },
    { id: 'MODERATE', label: 'Moderate (25-50%)', color: 'text-yellow-400 border-yellow-500/30' },
    { id: 'LOW', label: 'Low (<25%)', color: 'text-emerald-400 border-emerald-500/30' },
  ]

  const vehiclePresets = [
    { id: 'ALL', label: 'All Vehicles' },
    { id: 'BUS', label: 'Buses & Trucks' },
    { id: 'AUTO', label: 'Autos' },
    { id: 'CAR', label: 'Cars' },
    { id: 'SCOOTER', label: 'Two Wheelers' },
  ]

  return (
    <div className="w-full bg-bg-canvas border-b border-bg-border px-4 py-3 text-xs space-y-3 shrink-0 shadow-lg animate-fade-in">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-accent-yellow" />
          <span className="font-bold text-accent-yellow text-sm tracking-wide">
            Historical Data Archive Filters
          </span>
          <span className="px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue font-mono text-[11px] font-bold border border-accent-blue/30">
            {totalMatchingReports} Past Incidents Found
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onResetFilters}
            className="px-2.5 py-1 rounded-lg bg-bg-page border border-bg-border text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors text-[11px]"
          >
            <RotateCcw size={12} />
            <span>Reset Filters</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-bg-page border border-bg-border text-text-muted hover:text-text-primary"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Controls Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">

        {/* 1. Date Range Presets */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-text-muted flex items-center gap-1">
            <Calendar size={12} /> Date Horizon
          </label>
          <select
            value={dateRange}
            onChange={(e) => onChangeFilters({ ...filters, dateRange: e.target.value })}
            className="w-full bg-bg-page border border-bg-border rounded-lg px-2.5 py-1.5 text-text-primary font-medium text-xs focus:outline-none focus:border-accent-blue"
          >
            {datePresets.map(dp => (
              <option key={dp.id} value={dp.id}>{dp.label}</option>
            ))}
          </select>
        </div>

        {/* 2. Hour Filter (Time) */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px] font-bold text-text-muted">
            <span className="flex items-center gap-1"><Clock size={12} /> Time of Day</span>
            <span className="font-mono text-accent-yellow">{hourMin.toString().padStart(2, '0')}:00 - {hourMax.toString().padStart(2, '0')}:00</span>
          </div>
          <div className="flex items-center gap-2 bg-bg-page border border-bg-border rounded-lg px-2.5 py-1.5">
            <input
              type="range"
              min="0"
              max="23"
              value={hourMin}
              onChange={(e) => onChangeFilters({ ...filters, hourMin: Math.min(+e.target.value, hourMax) })}
              className="w-full h-1 bg-bg-hover rounded accent-accent-blue cursor-pointer"
            />
            <span className="text-[10px] font-mono text-text-muted">to</span>
            <input
              type="range"
              min="0"
              max="23"
              value={hourMax}
              onChange={(e) => onChangeFilters({ ...filters, hourMax: Math.max(+e.target.value, hourMin) })}
              className="w-full h-1 bg-bg-hover rounded accent-accent-blue cursor-pointer"
            />
          </div>
        </div>

        {/* 3. Severity / Risk Level */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-text-muted flex items-center gap-1">
            <ShieldAlert size={12} /> Severity Impact
          </label>
          <select
            value={severityRange}
            onChange={(e) => onChangeFilters({ ...filters, severityRange: e.target.value })}
            className="w-full bg-bg-page border border-bg-border rounded-lg px-2.5 py-1.5 text-text-primary font-medium text-xs focus:outline-none focus:border-accent-blue"
          >
            {severityPresets.map(sp => (
              <option key={sp.id} value={sp.id}>{sp.label}</option>
            ))}
          </select>
        </div>

        {/* 4. Vehicle Type & Heatmap Toggle */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-text-muted flex items-center gap-1">
            <Truck size={12} /> Vehicle Category
          </label>
          <div className="flex items-center gap-2">
            <select
              value={vehicleType}
              onChange={(e) => onChangeFilters({ ...filters, vehicleType: e.target.value })}
              className="flex-1 bg-bg-page border border-bg-border rounded-lg px-2.5 py-1.5 text-text-primary font-medium text-xs focus:outline-none focus:border-accent-blue"
            >
              {vehiclePresets.map(vp => (
                <option key={vp.id} value={vp.id}>{vp.label}</option>
              ))}
            </select>

            <button
              onClick={() => onChangeFilters({ ...filters, showHeatmap: !showHeatmap })}
              className={`px-2 py-1.5 rounded-lg border font-bold text-[11px] flex items-center gap-1 transition-colors ${
                showHeatmap
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : 'bg-bg-page text-text-muted border-bg-border hover:text-text-primary'
              }`}
              title="Toggle Heatmap Density Layer"
            >
              <Layers size={13} />
              <span>Heatmap</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  )
}
