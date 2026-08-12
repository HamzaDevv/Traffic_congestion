import React from 'react'
import { Play, Pause, RotateCcw, Zap, Calendar, Gauge, Radio, RefreshCw } from 'lucide-react'

export default function LiveStreamBar({
  streamStatus,
  onTogglePlay,
  onReset,
  onChangeSpeed,
  onTriggerInstantQuery,
  isProcessingInstant = false
}) {
  const {
    running = true,
    speed = 10,
    day_number = 1,
    progress_pct = 0,
    simulated_now = null,
    total_complaints = 0,
    index = 0
  } = streamStatus || {}

  const speeds = [1, 10, 60, 300]

  const formatSimulatedTime = (dtStr) => {
    if (!dtStr) return 'Day 1 of 15'
    try {
      const d = new Date(dtStr)
      if (isNaN(d.getTime())) return dtStr
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return dtStr
    }
  }

  return (
    <div className="w-full bg-bg-canvas/90 border-b border-bg-border px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs backdrop-blur-md shrink-0">
      
      {/* Left — Live Badge & Simulation Time */}
      <div className="flex items-center gap-3">
        {/* Live Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-extrabold tracking-wide">
          <Radio size={14} className="animate-pulse text-rose-500" />
          <span>15-DAY LIVE STREAM</span>
        </div>

        {/* Day & Progress */}
        <div className="flex items-center gap-2 font-mono text-text-primary bg-bg-page border border-bg-border px-2.5 py-1 rounded-lg">
          <Calendar size={14} className="text-accent-yellow" />
          <span className="font-bold text-accent-yellow">Day {day_number} / 15</span>
          <span className="text-text-muted">|</span>
          <span className="text-text-secondary">{formatSimulatedTime(simulated_now)}</span>
        </div>

        {/* Progress bar pill */}
        <div className="hidden lg:flex items-center gap-2 w-36">
          <div className="w-full h-1.5 bg-bg-page rounded-full overflow-hidden border border-bg-border">
            <div
              className="h-full bg-gradient-to-r from-accent-blue via-emerald-400 to-accent-yellow transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress_pct))}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-text-muted">{progress_pct}%</span>
        </div>
      </div>

      {/* Center/Right — Controls & Instant Query Button */}
      <div className="flex items-center gap-2">
        {/* Instant Query Trigger Button (Requested feature!) */}
        <button
          onClick={onTriggerInstantQuery}
          disabled={isProcessingInstant}
          className={`
            px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md text-xs
            bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300
            text-black border border-amber-300 hover:scale-105 active:scale-95
            ${isProcessingInstant ? 'opacity-70 cursor-wait animate-pulse' : ''}
          `}
          title="Simulate an incoming query right now! Triggers M1 Gatekeeper -> M2 Severity -> Stage 4 RL Tool Dispatch instantly."
        >
          <Zap size={15} className={`fill-black ${isProcessingInstant ? 'animate-spin' : ''}`} />
          <span>{isProcessingInstant ? 'Processing Query...' : '⚡ Live Simulate Query'}</span>
        </button>

        {/* Play/Pause */}
        <button
          onClick={onTogglePlay}
          className={`p-1.5 rounded-lg border transition-colors ${
            running
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
              : 'bg-bg-page border-bg-border text-text-muted hover:text-text-primary'
          }`}
          title={running ? 'Pause 15-Day Live Stream' : 'Resume 15-Day Live Stream'}
        >
          {running ? <Pause size={15} /> : <Play size={15} />}
        </button>

        {/* Speed Selector */}
        <div className="hidden sm:flex items-center bg-bg-page border border-bg-border rounded-lg p-0.5">
          <div className="px-1.5 py-0.5 text-[10px] text-text-muted font-mono flex items-center gap-1">
            <Gauge size={12} />
          </div>
          {speeds.map(sp => (
            <button
              key={sp}
              onClick={() => onChangeSpeed(sp)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${
                speed === sp
                  ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {sp}x
            </button>
          ))}
        </div>

        {/* Reset 15-Day Loop */}
        <button
          onClick={onReset}
          className="p-1.5 rounded-lg bg-bg-page border border-bg-border text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          title="Reset 15-Day Complaints Stream back to Start (Day 1)"
        >
          <RotateCcw size={15} />
        </button>
      </div>

    </div>
  )
}
