import { useState } from 'react'
import { postSimulate } from '../api'

const VEHICLE_TYPES = [
  'SCOOTER', 'MOTOR CYCLE', 'MOPED', 'CAR', 'VAN', 'PASSENGER AUTO',
  'GOODS AUTO', 'MAXI-CAB', 'LGV', 'BUS', 'TRUCK', 'TANKER', 'LORRY',
]

const VIOLATION_TYPES = [
  'WRONG PARKING', 'NO PARKING', 'PARKING IN A MAIN ROAD',
  'DOUBLE PARKING', 'PARKING NEAR ROAD CROSSING',
  'PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC',
  'PARKING OPPOSITE TO ANOTHER PARKED VEHICLE',
]

const JUNCTION_OPTIONS = [
  'No Junction',
  'Junction (Major)', 'Junction (Minor)',
  'BTP - Busy Traffic Point',
]

export default function SimulateForm({ onResult }) {
  const [form, setForm] = useState({
    latitude: 12.9716,
    longitude: 77.5946,
    vehicle_type: 'CAR',
    junction_name: 'No Junction',
    hour: 9,
    violation_types: ['WRONG PARKING'],
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const toggleViolation = (v) => {
    set('violation_types', form.violation_types.includes(v)
      ? form.violation_types.filter(x => x !== v)
      : [...form.violation_types, v]
    )
  }

  const submit = async () => {
    if (form.violation_types.length === 0) {
      setError('Select at least one violation type')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await postSimulate(form)
      setResult(res)
      onResult?.({
        lat: form.latitude,
        lon: form.longitude,
        severity: res.severity_score,
        approved: res.is_approved,
      })
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  const severityColor = (score) => {
    if (score < 0.25) return '#00e676'
    if (score < 0.5)  return '#ffea00'
    if (score < 0.75) return '#ff9100'
    return '#ff1744'
  }

  return (
    <div className="space-y-3">
      {/* Coordinates */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Latitude</label>
          <input
            type="number" step="0.0001"
            value={form.latitude}
            onChange={e => set('latitude', parseFloat(e.target.value))}
            className="w-full text-xs px-2 py-1.5 rounded-lg text-slate-200"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Longitude</label>
          <input
            type="number" step="0.0001"
            value={form.longitude}
            onChange={e => set('longitude', parseFloat(e.target.value))}
            className="w-full text-xs px-2 py-1.5 rounded-lg text-slate-200"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          />
        </div>
      </div>

      {/* Vehicle type */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Vehicle Type</label>
        <select
          value={form.vehicle_type}
          onChange={e => set('vehicle_type', e.target.value)}
          className="w-full text-xs px-2 py-1.5 rounded-lg text-slate-200"
          style={{
            background: 'rgba(7,21,41,0.8)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {/* Hour */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">
          Time of Day — {form.hour}:00 ({form.hour < 12 ? 'AM' : 'PM'})
          {(form.hour >= 8 && form.hour <= 11) && <span style={{ color: '#ff9100' }}> ⚠ Peak</span>}
        </label>
        <input
          type="range" min={0} max={23}
          value={form.hour}
          onChange={e => set('hour', Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-600 mt-0.5">
          <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span>
        </div>
      </div>

      {/* Junction */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Location Type</label>
        <select
          value={form.junction_name}
          onChange={e => set('junction_name', e.target.value)}
          className="w-full text-xs px-2 py-1.5 rounded-lg text-slate-200"
          style={{
            background: 'rgba(7,21,41,0.8)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {JUNCTION_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
      </div>

      {/* Violations */}
      <div>
        <label className="text-xs text-slate-400 mb-1.5 block">Violation Types</label>
        <div className="flex flex-wrap gap-1">
          {VIOLATION_TYPES.map(v => {
            const active = form.violation_types.includes(v)
            return (
              <button
                key={v}
                onClick={() => toggleViolation(v)}
                className="text-xs px-2 py-0.5 rounded-full transition-all duration-150"
                style={{
                  background: active ? 'rgba(255,109,0,0.2)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(255,109,0,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  color: active ? '#ff9100' : '#64748b',
                }}
              >
                {v.replace('PARKING ', '').toLowerCase()}
              </button>
            )
          })}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={submit}
        disabled={loading}
        className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200"
        style={{
          background: loading
            ? 'rgba(0,229,255,0.1)'
            : 'linear-gradient(135deg, rgba(0,229,255,0.25), rgba(0,180,216,0.2))',
          border: '1px solid rgba(0,229,255,0.4)',
          color: loading ? '#64748b' : '#00e5ff',
          boxShadow: loading ? 'none' : '0 0 16px rgba(0,229,255,0.15)',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '⏳ Running AI Cascade...' : '🤖 Run 3-Stage AI Analysis'}
      </button>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 text-center animate-fade-in">{error}</div>
      )}

      {/* Result */}
      {result && (
        <div
          className="rounded-xl p-3 animate-fade-in"
          style={{
            background: result.is_approved ? 'rgba(0,230,118,0.08)' : 'rgba(255,23,68,0.08)',
            border: `1px solid ${result.is_approved ? 'rgba(0,230,118,0.3)' : 'rgba(255,23,68,0.3)'}`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm"
              style={{ color: result.is_approved ? '#00e676' : '#ff1744' }}>
              {result.is_approved ? '✓ APPROVED' : '✗ REJECTED'}
            </span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                color: severityColor(result.severity_score),
                background: `${severityColor(result.severity_score)}18`,
                border: `1px solid ${severityColor(result.severity_score)}40`,
              }}
            >
              {result.severity_label}
            </span>
          </div>

          {/* Severity bar */}
          <div className="mb-2">
            <div className="text-xs text-slate-400 mb-1">
              Disruption Severity Score
            </div>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '6px' }}>
              <div style={{
                width: `${result.severity_score * 100}%`,
                height: '100%',
                borderRadius: '4px',
                background: `linear-gradient(90deg, #00e676, ${severityColor(result.severity_score)})`,
                transition: 'width 0.6s ease',
                boxShadow: `0 0 8px ${severityColor(result.severity_score)}60`,
              }} />
            </div>
            <div className="text-right text-xs mt-0.5"
              style={{ color: severityColor(result.severity_score) }}>
              {(result.severity_score * 100).toFixed(1)}%
            </div>
          </div>

          {result.nearest_cluster_id !== null && (
            <div className="text-xs text-slate-400">
              📍 Nearest hotspot: <strong className="text-slate-200">
                {(result.nearest_cluster_dist_m / 1000).toFixed(2)}km away
              </strong>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
