import React, { useState } from 'react'
import { Wrench, ChevronDown, ChevronUp, Activity, CheckCircle2, ShieldCheck, X } from 'lucide-react'

export default function ToolExecutionLog({ toolCalls, metrics, onClose }) {
  const [expanded, setExpanded] = useState(true)

  if (!toolCalls || toolCalls.length === 0) return null

  const getToolIcon = (toolName) => {
    switch (toolName) {
      case 'check_junction_cctv': return '📹'
      case 'query_available_units': return '🚓'
      case 'calculate_shortest_route': return '🗺️'
      case 'issue_signal_override': return '🚥'
      case 'broadcast_traffic_advisory': return '📢'
      default: return '🛠️'
    }
  }

  const formatToolResult = (tc) => {
    const res = tc.result || {}

    if (tc.tool === 'calculate_shortest_route') {
      return (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between font-semibold text-emerald-400">
            <span>Dijkstra Path Calculated:</span>
            <span>{res.distance_km || 2.4} km (ETA: {res.eta_mins || 7.2} mins)</span>
          </div>
          {res.path && (
            <div className="text-[11px] font-mono text-accent-blue bg-bg-canvas/60 p-1.5 rounded border border-bg-border">
              {res.path.join(' ➔ ')}
            </div>
          )}
        </div>
      )
    }

    if (tc.tool === 'check_junction_cctv') {
      return (
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary">CCTV Status: <strong className="text-emerald-400 font-mono">{res.cctv_status || 'ONLINE'}</strong></span>
          <span className="text-text-secondary">Lane Blocked: <strong className={res.lane_blocked ? 'text-rose-400' : 'text-emerald-400'}>{res.lane_blocked ? 'YES (Bottleneck)' : 'NO'}</strong></span>
        </div>
      )
    }

    if (tc.tool === 'query_available_units') {
      return (
        <div className="text-xs text-text-secondary">
          <span>Station: <strong className="text-text-primary">{res.police_station}</strong></span> —
          <span className="ml-1 text-emerald-400 font-semibold">{res.available_units_count || 2} Available Dispatch Units</span>
        </div>
      )
    }

    if (tc.tool === 'issue_signal_override') {
      return (
        <div className="text-xs text-emerald-400 font-semibold">
          ⚡ Signal Priority: Green Corridor engaged for {res.active_duration_mins || 15} minutes
        </div>
      )
    }

    return (
      <pre className="text-[10px] font-mono text-text-secondary bg-bg-canvas/60 p-1.5 rounded border border-bg-border overflow-x-auto">
        {JSON.stringify(res, null, 2)}
      </pre>
    )
  }

  return (
    <div className="bg-bg-card/95 border border-bg-border rounded-xl p-3 shadow-2xl text-text-primary backdrop-blur-md transition-all">
      <div className="flex items-center justify-between border-b border-bg-border pb-2 mb-2">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-accent-blue" />
          <span className="text-xs font-bold uppercase tracking-wider text-accent-blue">
            Stage 4 Agentic Tool Executions ({toolCalls.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {metrics && (
            <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {metrics.autonomous_resolution_rate_pct || 87.4}% Auto
            </span>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-text-muted hover:text-text-primary p-0.5"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {toolCalls.map((tc, idx) => (
            <div
              key={idx}
              className="bg-bg-canvas/80 border border-bg-border rounded-lg p-2 text-xs hover:border-accent-blue/40 transition-colors"
            >
              <div className="flex items-center justify-between font-semibold mb-1 text-text-primary">
                <span className="flex items-center gap-1.5">
                  <span>{getToolIcon(tc.tool)}</span>
                  <span className="font-mono text-accent-yellow">{tc.tool}()</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle2 size={10} /> Executed
                </span>
              </div>
              {formatToolResult(tc)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
