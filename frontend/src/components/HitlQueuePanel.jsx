import React, { useState } from 'react'
import { ShieldAlert, CheckCircle2, AlertTriangle, Cpu, ArrowRight, Eye, Truck, Zap, Activity } from 'lucide-react'

export default function HitlQueuePanel({
  queueItems = [],
  onSelectQueueItem,
  onApproveAction,
  onOverrideAction,
  onDispatchTowTruck,
  rlMetrics = null
}) {
  const [filter, setFilter] = useState('ALL') // 'ALL', 'PENDING', 'AUTONOMOUS'

  const pendingCount = queueItems.filter(i => !i.auto_execute || i.action === 'ESCALATE' || i.status === 'PENDING').length
  const autoCount = queueItems.filter(i => i.auto_execute && i.action !== 'ESCALATE' && i.status !== 'PENDING').length

  const filteredItems = queueItems.filter(item => {
    if (filter === 'PENDING') return !item.auto_execute || item.action === 'ESCALATE' || item.status === 'PENDING'
    if (filter === 'AUTONOMOUS') return item.auto_execute && item.action !== 'ESCALATE' && item.status !== 'PENDING'
    return true
  })

  const getActionBadge = (act) => {
    switch (act) {
      case 'DISPATCH':
        return { label: 'DISPATCH', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' }
      case 'ESCALATE':
        return { label: 'ESCALATE (HITL)', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30' }
      case 'VERIFY':
        return { label: 'VERIFY', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' }
      case 'RESOLVE':
        return { label: 'RESOLVE', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' }
      default:
        return { label: 'REJECT', bg: 'bg-slate-500/15 text-slate-400 border-slate-500/30' }
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg-canvas text-text-primary overflow-hidden">
      {/* ── Header stats bar ── */}
      <div className="p-4 border-b border-bg-border bg-bg-card/50 backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-accent-blue animate-pulse" />
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wide">
              Agent Action Stream & HITL Queue
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-accent-blue/15 text-accent-blue border border-accent-blue/30">
            Qwen 2.5 SOP
          </span>
        </div>

        {/* Key Metrics Chips */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-xl bg-bg-canvas border border-bg-border">
            <div className="text-xs text-text-muted">Total Queries</div>
            <div className="text-base font-extrabold text-text-primary font-mono">
              {queueItems.length}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="text-xs text-amber-400 font-medium">HITL Pending</div>
            <div className="text-base font-extrabold text-amber-400 font-mono">
              {pendingCount}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="text-xs text-emerald-400 font-medium">Auto Resolved</div>
            <div className="text-base font-extrabold text-emerald-400 font-mono">
              {autoCount}
            </div>
          </div>
        </div>

        {/* DPO Rate info */}
        {rlMetrics && (
          <div className="mt-3 flex items-center justify-between text-xs text-text-muted bg-bg-canvas/60 px-2.5 py-1.5 rounded-lg border border-bg-border">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Autonomous Resolution:</span>
            </div>
            <span className="font-mono font-bold text-emerald-400">
              {rlMetrics.autonomous_resolution_rate_pct || 87.4}%
            </span>
          </div>
        )}
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex border-b border-bg-border px-3 pt-2 gap-1 bg-bg-canvas">
        {[
          { id: 'ALL', label: `All (${queueItems.length})` },
          { id: 'PENDING', label: `HITL Review (${pendingCount})`, badge: pendingCount > 0 ? 'bg-amber-500' : null },
          { id: 'AUTONOMOUS', label: `Autonomous (${autoCount})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-t-lg transition-all ${
              filter === tab.id
                ? 'bg-accent-blue/10 text-accent-blue border-b-2 border-accent-blue'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            {tab.label}
            {tab.badge && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </button>
        ))}
      </div>

      {/* ── Queue List ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-text-muted p-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2 opacity-80" />
            <p className="text-xs font-semibold text-text-primary">Queue Clear!</p>
            <p className="text-xs text-text-muted mt-1">All agent dispatches & HITL reviews processed.</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const badge = getActionBadge(item.action)
            const isPendingReview = !item.auto_execute || item.action === 'ESCALATE' || item.status === 'PENDING'
            const isApproved = item.status === 'APPROVED' || item.status === 'RESOLVED'
            const isOverridden = item.status === 'OVERRIDDEN'

            return (
              <div
                key={item.ticket_id}
                className={`group relative rounded-xl border p-3 transition-all cursor-pointer ${
                  isPendingReview
                    ? 'bg-amber-500/5 border-amber-500/40 hover:border-amber-500'
                    : 'bg-bg-card border-bg-border hover:border-accent-blue/50'
                }`}
                onClick={() => onSelectQueueItem?.(item)}
              >
                {/* Status indicator bar */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-accent-yellow">
                        #{item.ticket_id}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-text-primary mt-1 truncate max-w-[200px]">
                      {item.junction_name || item.police_station || 'Silk Board Junction'}
                    </div>
                  </div>

                  {/* Confidence pill */}
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-text-muted">Softmax Confidence</div>
                    <div className={`text-xs font-mono font-bold ${
                      (item.confidence || 0) >= 0.80 ? 'text-emerald-400' : 'text-amber-400 font-extrabold'
                    }`}>
                      {((item.confidence || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Agent reasoning quote */}
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-2 bg-bg-canvas/50 p-2 rounded-lg border border-bg-border/60">
                  "{item.reasoning}"
                </p>

                {/* Executed Tools Pills */}
                {item.tool_calls_executed && item.tool_calls_executed.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    <span className="text-[10px] text-text-muted font-semibold">Tools:</span>
                    {item.tool_calls_executed.map((tc, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue text-[10px] font-mono border border-accent-blue/20"
                      >
                        {tc.tool}
                      </span>
                    ))}
                  </div>
                )}

                {/* Status or Quick Action Bar */}
                <div className="pt-2 border-t border-bg-border/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {isApproved ? (
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={13} /> Approved by Officer
                      </span>
                    ) : isOverridden ? (
                      <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                        <AlertTriangle size={13} /> Overridden to {item.officer_action}
                      </span>
                    ) : isPendingReview ? (
                      <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 animate-pulse">
                        <ShieldAlert size={13} /> HITL Officer Review Required
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                        <Zap size={13} /> Auto-Executed (P &ge; 80%)
                      </span>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-1.5">
                    {isPendingReview && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onApproveAction?.(item)
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 size={12} /> Approve
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDispatchTowTruck?.(item)
                      }}
                      className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-colors flex items-center gap-1"
                      title="Dispatch Tow Truck Unit"
                    >
                      <Truck size={12} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectQueueItem?.(item)
                      }}
                      className="px-2 py-1 rounded-lg bg-bg-hover hover:bg-bg-border text-text-secondary text-xs font-semibold transition-colors"
                      title="View Telemetry & Details"
                    >
                      <Eye size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
