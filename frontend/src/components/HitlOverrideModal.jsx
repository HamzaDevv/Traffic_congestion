import React, { useState } from 'react'
import { ShieldAlert, Truck, CheckCircle2, AlertTriangle, X, Activity, Wrench } from 'lucide-react'

const ACTIONS = ['VERIFY', 'DISPATCH', 'RESOLVE', 'REJECT', 'ESCALATE']

export default function HitlOverrideModal({
  isOpen,
  prediction,
  onClose,
  onSubmitFeedback,
  onDispatchTowTruck
}) {
  if (!isOpen || !prediction) return null

  const [selectedAction, setSelectedAction] = useState(prediction.action)
  const [officerNotes, setOfficerNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isOverride = selectedAction !== prediction.action

  const handleSubmit = async (isApprovedChoice) => {
    setIsSubmitting(true)
    const finalAction = isApprovedChoice ? prediction.action : selectedAction

    try {
      await onSubmitFeedback({
        ticket_id: prediction.ticket_id,
        original_action: prediction.action,
        officer_action: finalAction,
        is_approved: isApprovedChoice,
        officer_notes: officerNotes,
        incident_state: {
          severity_score: prediction.severity_score,
          assigned_unit: prediction.assigned_unit
        }
      })

      // If action is DISPATCH or ESCALATE, trigger tow truck animation
      if ((finalAction === 'DISPATCH' || finalAction === 'ESCALATE') && onDispatchTowTruck) {
        onDispatchTowTruck(prediction)
      }

      onClose()
    } catch (err) {
      console.error('Failed to log officer feedback:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getActionColor = (act) => {
    switch (act) {
      case 'DISPATCH': return 'bg-emerald-500 text-white'
      case 'ESCALATE': return 'bg-rose-500 text-white'
      case 'VERIFY': return 'bg-amber-500 text-white'
      case 'RESOLVE': return 'bg-blue-500 text-white'
      default: return 'bg-slate-600 text-white'
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div className="bg-bg-card border border-bg-border rounded-2xl p-6 max-w-2xl w-full text-text-primary shadow-2xl space-y-5">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 animate-pulse" />
              Human-in-the-Loop Officer Override Portal
            </div>
            <h2 className="text-xl font-extrabold text-text-primary mt-1">
              Incident #{prediction.ticket_id}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Model Recommendation Box ── */}
        <div className="bg-bg-canvas/90 border border-bg-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted font-medium">Qwen 2.5 Policy Action:</span>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-extrabold uppercase tracking-wide ${getActionColor(prediction.action)}`}>
                {prediction.action}
              </span>
            </div>
            <div className="text-xs">
              <span className="text-text-muted">Softmax Confidence: </span>
              <span className={`font-mono font-bold ${
                (prediction.confidence || 0) >= 0.80 ? 'text-emerald-400' : 'text-amber-400 font-extrabold'
              }`}>
                {((prediction.confidence || 0) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed italic bg-bg-card/50 p-2.5 rounded-lg border border-bg-border/60">
            "{prediction.reasoning}"
          </p>

          {/* Executed Tools Summary */}
          {prediction.tool_calls_executed && prediction.tool_calls_executed.length > 0 && (
            <div className="bg-bg-card/60 p-2.5 rounded-lg border border-bg-border text-xs space-y-1.5">
              <div className="font-semibold text-accent-blue flex items-center gap-1.5">
                <Wrench size={13} /> Executed Agentic Tools ({prediction.tool_calls_executed.length}):
              </div>
              {prediction.tool_calls_executed.map((tc, idx) => (
                <div key={idx} className="text-[11px] text-text-muted flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
                  <strong className="text-text-primary font-mono">{tc.tool}()</strong>
                  <span className="truncate max-w-xs text-text-muted">
                    {JSON.stringify(tc.result).slice(0, 65)}...
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Officer Override Selection ── */}
        <div>
          <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
            Officer Action Choice / Override:
          </label>
          <div className="flex gap-2 flex-wrap">
            {ACTIONS.map((act) => {
              const isSelected = selectedAction === act
              return (
                <button
                  key={act}
                  type="button"
                  onClick={() => setSelectedAction(act)}
                  className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl font-bold text-xs transition-all border ${
                    isSelected
                      ? 'bg-accent-blue text-white border-accent-blue shadow-lg shadow-accent-blue/30 scale-105'
                      : 'bg-bg-canvas text-text-muted border-bg-border hover:bg-bg-hover hover:text-text-primary'
                  }`}
                >
                  {act}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Officer DPO Log Notes ── */}
        <div>
          <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
            Officer DPO Rationale (Continuous RL Alignment):
          </label>
          <textarea
            value={officerNotes}
            onChange={(e) => setOfficerNotes(e.target.value)}
            placeholder="Add operational rationale for approval or override decision..."
            rows={2}
            className="w-full bg-bg-canvas border border-bg-border rounded-xl p-3 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue"
          />
        </div>

        {/* ── Modal Footer Buttons ── */}
        <div className="flex items-center justify-between pt-2 border-t border-bg-border">
          <button
            type="button"
            onClick={() => {
              if (onDispatchTowTruck) onDispatchTowTruck(prediction)
            }}
            className="px-3 py-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/25 transition-colors flex items-center gap-1.5"
          >
            <Truck size={14} /> Dispatch Tow Unit Now
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting || !isOverride}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                isOverride
                  ? 'bg-amber-500 hover:bg-amber-600 text-black shadow-md'
                  : 'bg-bg-hover text-text-muted cursor-not-allowed'
              }`}
            >
              Submit Override Action
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors shadow-md flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} /> Approve Qwen Action ({prediction.action})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
