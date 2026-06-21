import { useState, useEffect, useRef } from 'react'
import { Play, Pause, Radio, Rewind, AlertTriangle } from 'lucide-react'

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12
  const ampm = i < 12 ? 'AM' : 'PM'
  return `${h}${ampm}`
})

export default function TimeSlider({ timeline, onRangeChange }) {
  const [currentHour, setCurrentHour] = useState(23)
  const [playing, setPlaying] = useState(false)
  const [mode, setMode] = useState('live') // 'live' | 'playback'
  const [speed, setSpeed] = useState(1) // 1, 2, 5
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
      setMode('playback')
      timerRef.current = setInterval(() => {
        setCurrentHour(h => {
          if (h >= 23) {
            setPlaying(false)
            return 23
          }
          return h + 1
        })
      }, 800 / speed)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [playing])

  const togglePlay = () => {
    if (!playing && currentHour >= 23) setCurrentHour(0)
    setPlaying(p => !p)
  }

  const cycleSpeed = () => {
    setSpeed(s => s === 1 ? 2 : s === 2 ? 5 : 1)
  }

  // Get violation count for hour
  const hourData = timeline.find(t => t.hour === currentHour)
  const maxCount = Math.max(...(timeline.map(t => t.count) || [1]))

  return (
    <div className="bg-bg-card border border-bg-border rounded-xl px-2.5 sm:px-4 py-2 sm:py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
              playing
                ? 'bg-accent-orange/10 border-accent-orange/30 text-accent-orange'
                : 'bg-accent-blue/10 border-accent-blue/30 text-accent-blue'
            }`}
            title={playing ? 'Pause time-lapse' : 'Play time-lapse'}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>

          {/* Mode toggle */}
          <button
            onClick={() => {
              setMode(m => m === 'live' ? 'playback' : 'live')
              if (mode === 'live') setPlaying(false)
            }}
            className={`flex items-center gap-1 sm:gap-1.5 text-xs px-2 sm:px-3 py-1 rounded-lg border font-medium transition-colors ${
              mode === 'live'
                ? 'bg-risk-low/10 border-risk-low/30 text-risk-low'
                : 'bg-bg-canvas border-bg-border text-text-muted hover:bg-bg-hover'
            }`}
          >
            {mode === 'live' ? (
              <>
                <Radio size={12} />
                <span className="hidden sm:inline">Live Mode</span>
                <span className="sm:hidden">Live</span>
              </>
            ) : (
              <>
                <Rewind size={12} />
                <span className="hidden sm:inline">Playback</span>
              </>
            )}
          </button>

          {mode === 'playback' && (
            <button
              onClick={cycleSpeed}
              className="text-xs px-2 py-1 rounded-lg border border-bg-border hover:bg-bg-hover text-text-secondary font-medium transition-colors"
            >
              {speed}x
            </button>
          )}

          <span className="text-xs text-text-muted hidden sm:inline">
            Time-lapse
          </span>
        </div>

        {/* Current time + stats */}
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="text-base sm:text-lg font-medium text-accent-yellow leading-none">
              {HOUR_LABELS[currentHour]}
            </div>
            {hourData && (
              <div className="text-xs text-text-muted font-mono">
                {hourData.count} reports
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mini timeline bar chart */}
      <div className="flex items-end gap-px sm:gap-0.5 h-6 sm:h-8 mb-2">
        {Array.from({ length: 24 }, (_, h) => {
          const data = timeline.find(t => t.hour === h)
          const count = data ? data.count : 0
          const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0
          const isCurrent = h === currentHour

          return (
            <button
              key={h}
              onClick={() => { setMode('playback'); setCurrentHour(h); setPlaying(false) }}
              className={`flex-1 rounded-sm transition-all duration-200 ${
                isCurrent
                  ? 'bg-accent-blue'
                  : 'bg-bg-border/50 hover:bg-bg-border'
              }`}
              style={{ height: `${Math.max(8, heightPct)}%` }}
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
          setMode('playback')
          setCurrentHour(Number(e.target.value))
          setPlaying(false)
        }}
        className="w-full"
        disabled={mode === 'live'}
      />

      {/* Hour labels */}
      <div className="flex justify-between text-[10px] sm:text-xs text-text-muted mt-1 px-0.5">
        <span>12AM</span>
        <span>6AM</span>
        <span>12PM</span>
        <span>6PM</span>
        <span>11PM</span>
      </div>

      {/* Peak hour indicator */}
      {(currentHour >= 8 && currentHour <= 11) && (
        <div className="mt-2 text-center text-xs font-medium text-risk-moderate flex items-center justify-center gap-1">
          <AlertTriangle size={12} />
          Morning Peak — Highest Congestion Impact
        </div>
      )}
      {(currentHour >= 17 && currentHour <= 19) && (
        <div className="mt-2 text-center text-xs font-medium text-risk-moderate flex items-center justify-center gap-1">
          <AlertTriangle size={12} />
          Evening Rush Hour
        </div>
      )}
    </div>
  )
}
