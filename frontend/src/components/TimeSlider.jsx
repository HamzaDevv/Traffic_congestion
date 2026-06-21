import { useState, useEffect, useRef } from 'react'

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12
  const ampm = i < 12 ? 'AM' : 'PM'
  return `${h}${ampm}`
})

export default function TimeSlider({ timeline, onRangeChange }) {
  const [currentHour, setCurrentHour] = useState(23)
  const [playing, setPlaying] = useState(false)
  const [mode, setMode] = useState('single') // 'single' | 'all'
  const timerRef = useRef(null)

  // Report selected range to parent
  useEffect(() => {
    if (mode === 'all') {
      onRangeChange(0, 23)
    } else {
      onRangeChange(currentHour, currentHour)
    }
  }, [currentHour, mode, onRangeChange])

  // Playback ticker
  useEffect(() => {
    if (playing) {
      setMode('single')
      timerRef.current = setInterval(() => {
        setCurrentHour(h => {
          if (h >= 23) {
            setPlaying(false)
            return 23
          }
          return h + 1
        })
      }, 800)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [playing])

  const togglePlay = () => {
    if (!playing && currentHour >= 23) setCurrentHour(0)
    setPlaying(p => !p)
  }

  // Get violation count for hour
  const hourData = timeline.find(t => t.hour === currentHour)
  const maxCount = Math.max(...(timeline.map(t => t.count) || [1]))

  return (
    <div className="glass px-4 py-3 rounded-2xl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200"
            style={{
              background: playing
                ? 'rgba(255, 109, 0, 0.2)'
                : 'rgba(0, 229, 255, 0.15)',
              border: playing
                ? '1px solid rgba(255, 109, 0, 0.5)'
                : '1px solid rgba(0, 229, 255, 0.4)',
              color: playing ? '#ff9100' : '#00e5ff',
              boxShadow: playing
                ? '0 0 12px rgba(255,109,0,0.3)'
                : '0 0 12px rgba(0,229,255,0.2)',
            }}
            title={playing ? 'Pause time-lapse' : 'Play time-lapse'}
          >
            {playing ? '⏸' : '▶'}
          </button>

          {/* Mode toggle */}
          <button
            onClick={() => setMode(m => m === 'all' ? 'single' : 'all')}
            className="text-xs px-3 py-1 rounded-full transition-all duration-200"
            style={{
              background: mode === 'all'
                ? 'rgba(0, 229, 255, 0.15)'
                : 'rgba(255,255,255,0.04)',
              border: mode === 'all'
                ? '1px solid rgba(0, 229, 255, 0.4)'
                : '1px solid rgba(255,255,255,0.08)',
              color: mode === 'all' ? '#00e5ff' : '#64748b',
            }}
          >
            {mode === 'all' ? '🕐 All Hours' : '📍 Hourly'}
          </button>

          <span className="text-xs text-slate-400">
            Time-lapse — violations by hour
          </span>
        </div>

        {/* Current time + stats */}
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="text-lg font-bold gradient-text leading-none">
              {HOUR_LABELS[currentHour]}
            </div>
            {hourData && (
              <div className="text-xs text-slate-500">
                {hourData.count} reports
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mini timeline bar chart */}
      <div className="flex items-end gap-0.5 h-8 mb-2">
        {Array.from({ length: 24 }, (_, h) => {
          const data = timeline.find(t => t.hour === h)
          const count = data ? data.count : 0
          const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0
          const isActive = mode === 'all' || h === currentHour
          const isCurrent = h === currentHour

          return (
            <button
              key={h}
              onClick={() => { setMode('single'); setCurrentHour(h); setPlaying(false) }}
              className="flex-1 rounded-sm transition-all duration-200"
              style={{
                height: `${Math.max(8, heightPct)}%`,
                background: isCurrent
                  ? '#00e5ff'
                  : isActive
                    ? `rgba(0, 229, 255, ${0.2 + heightPct * 0.004})`
                    : 'rgba(255,255,255,0.05)',
                boxShadow: isCurrent ? '0 0 6px rgba(0,229,255,0.6)' : 'none',
              }}
              title={`${HOUR_LABELS[h]}: ${count} reports`}
            />
          )
        })}
      </div>

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={23}
        value={currentHour}
        onChange={e => {
          setMode('single')
          setCurrentHour(Number(e.target.value))
          setPlaying(false)
        }}
        className="w-full"
        disabled={mode === 'all'}
      />

      {/* Hour labels */}
      <div className="flex justify-between text-xs text-slate-600 mt-1 px-0.5">
        <span>12AM</span>
        <span>6AM</span>
        <span>12PM</span>
        <span>6PM</span>
        <span>11PM</span>
      </div>

      {/* Peak hour indicator */}
      {(currentHour >= 8 && currentHour <= 11) && (
        <div className="mt-2 text-center text-xs font-medium"
          style={{ color: '#ff9100' }}>
          ⚠ Morning Peak — Highest Congestion Impact
        </div>
      )}
      {(currentHour >= 17 && currentHour <= 19) && (
        <div className="mt-2 text-center text-xs font-medium"
          style={{ color: '#ffea00' }}>
          ⚠ Evening Rush Hour
        </div>
      )}
    </div>
  )
}
