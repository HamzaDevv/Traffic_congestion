import { useState } from 'react'
import { Send, Loader2, AlertTriangle } from 'lucide-react'
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

  const getSeverityTokenClass = (score) => {
    if (score < 0.25) return 'text-risk-low bg-risk-low'
    if (score < 0.5)  return 'text-risk-moderate bg-risk-moderate'
    if (score < 0.75) return 'text-risk-high bg-risk-high'
    return 'text-risk-critical bg-risk-critical'
  }

  return (
    <div className="space-y-3">
      {/* Coordinates */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Latitude</label>
          <input
            type="number" step="0.0001"
            value={form.latitude}
            onChange={e => set('latitude', parseFloat(e.target.value))}
            className="w-full bg-bg-canvas border border-bg-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:ring-1 focus:ring-accent-blue focus:border-accent-blue"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Longitude</label>
          <input
            type="number" step="0.0001"
            value={form.longitude}
            onChange={e => set('longitude', parseFloat(e.target.value))}
            className="w-full bg-bg-canvas border border-bg-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:ring-1 focus:ring-accent-blue focus:border-accent-blue"
          />
        </div>
      </div>

      {/* Vehicle type */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Vehicle Type</label>
        <select
          value={form.vehicle_type}
          onChange={e => set('vehicle_type', e.target.value)}
          className="w-full bg-bg-canvas border border-bg-border rounded-lg px-3 py-2 text-xs text-text-primary focus:ring-1 focus:ring-accent-blue focus:border-accent-blue"
        >
          {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {/* Hour */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-widest text-text-muted mb-2">
          Time of Day — <span className="font-mono">{form.hour}:00</span> ({form.hour < 12 ? 'AM' : 'PM'})
          {(form.hour >= 8 && form.hour <= 11) && (
            <span className="text-risk-moderate ml-1">
              <AlertTriangle size={10} className="inline -mt-0.5" /> Peak
            </span>
          )}
        </label>
        <input
          type="range" min={0} max={23}
          value={form.hour}
          onChange={e => set('hour', Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-text-muted mt-0.5">
          <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span>
        </div>
      </div>

      {/* Junction */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Location Type</label>
        <select
          value={form.junction_name}
          onChange={e => set('junction_name', e.target.value)}
          className="w-full bg-bg-canvas border border-bg-border rounded-lg px-3 py-2 text-xs text-text-primary focus:ring-1 focus:ring-accent-blue focus:border-accent-blue"
        >
          {JUNCTION_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
      </div>

      {/* Violations */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Violation Types</label>
        <div className="flex flex-wrap gap-1">
          {VIOLATION_TYPES.map(v => {
            const active = form.violation_types.includes(v)
            return (
              <button
                key={v}
                onClick={() => toggleViolation(v)}
                className={`text-xs px-2 py-0.5 rounded-full transition-colors border ${
                  active
                    ? 'bg-accent-orange/15 border-accent-orange/50 text-accent-orange'
                    : 'bg-bg-canvas border-bg-border text-text-muted hover:bg-bg-hover'
                }`}
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
        className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
          loading
            ? 'bg-bg-border text-text-muted cursor-not-allowed'
            : 'bg-accent-yellow text-bg-canvas hover:opacity-90 cursor-pointer'
        }`}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Running AI Cascade...
          </>
        ) : (
          <>
            <Send size={16} />
            Run 3-Stage AI Analysis
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="p-4 bg-risk-critical/10 border border-risk-critical/30 rounded-xl text-sm font-medium text-risk-critical animate-fade-in">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`rounded-xl p-3 border animate-fade-in ${
            result.is_approved
              ? 'bg-risk-low/10 border-risk-low/30'
              : 'bg-risk-critical/10 border-risk-critical/30'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`font-medium text-sm ${result.is_approved ? 'text-risk-low' : 'text-risk-critical'}`}>
              {result.is_approved ? 'APPROVED' : 'REJECTED'}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${getSeverityTokenClass(result.severity_score).split(' ')[0]} ${getSeverityTokenClass(result.severity_score).split(' ')[1]}/15`}>
              {result.severity_label}
            </span>
          </div>

          {/* Severity bar */}
          <div className="mb-2">
            <div className="text-xs text-text-muted mb-1">
              Disruption Severity Score
            </div>
            <div className="bg-bg-border/30 rounded-sm h-[6px]">
              <div
                className={`h-full rounded-sm ${getSeverityTokenClass(result.severity_score).split(' ')[1]}`}
                style={{
                  width: `${result.severity_score * 100}%`,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
            <div className={`text-right text-xs mt-0.5 font-mono ${getSeverityTokenClass(result.severity_score).split(' ')[0]}`}>
              {(result.severity_score * 100).toFixed(1)}%
            </div>
          </div>

          {result.nearest_cluster_id !== null && (
            <div className="text-xs text-text-muted">
              Nearest hotspot: <strong className="text-text-primary">
                {(result.nearest_cluster_dist_m / 1000).toFixed(2)}km away
              </strong>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
