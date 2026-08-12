import React, { useState } from 'react'

const ACTIONS = ['VERIFY', 'DISPATCH', 'RESOLVE', 'REJECT', 'ESCALATE']

export default function HitlOverrideModal({ isOpen, prediction, onClose, onSubmitFeedback }) {
  if (!isOpen || !prediction) return null

  const [selectedAction, setSelectedAction] = useState(prediction.action)
  const [officerNotes, setOfficerNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isOverride = selectedAction !== prediction.action

  const handleSubmit = async (isApprovedChoice) => {
    setIsSubmitting(true)
    try {
      await onSubmitFeedback({
        ticket_id: prediction.ticket_id,
        original_action: prediction.action,
        officer_action: isApprovedChoice ? prediction.action : selectedAction,
        is_approved: isApprovedChoice,
        officer_notes: officerNotes,
        incident_state: {
          severity_score: prediction.severity_score,
          assigned_unit: prediction.assigned_unit
        }
      })
      onClose()
    } catch (err) {
      console.error('Failed to log officer feedback:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getActionColor = (act) => {
    switch (act) {
      case 'DISPATCH': return '#10b981'
      case 'ESCALATE': return '#ef4444'
      case 'VERIFY': return '#f59e0b'
      case 'RESOLVE': return '#3b82f6'
      default: return '#6b7280'
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '16px',
        padding: '28px',
        maxWidth: '640px',
        width: '90%',
        color: '#f8fafc',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.05em', color: '#f59e0b', textTransform: 'uppercase' }}>
              ⚠️ Human-in-the-Loop Officer Override Required
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0 0 0', color: '#f8fafc' }}>
              Incident Ticket #{prediction.ticket_id}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Prediction Card */}
        <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Qwen 2.5 Policy Action:</span>
              <span style={{
                marginLeft: '8px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '13px',
                backgroundColor: getActionColor(prediction.action),
                color: '#ffffff'
              }}>
                {prediction.action}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Softmax Confidence: </span>
              <span style={{ fontWeight: '700', color: prediction.confidence >= 0.8 ? '#10b981' : '#f59e0b' }}>
                {(prediction.confidence * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.5', margin: '0 0 12px 0' }}>
            "{prediction.reasoning}"
          </p>

          {/* Executed Tools Summary */}
          {prediction.tool_calls_executed && prediction.tool_calls_executed.length > 0 && (
            <div style={{ backgroundColor: '#1e293b', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', color: '#94a3b8' }}>
              <div style={{ fontWeight: '600', color: '#38bdf8', marginBottom: '4px' }}>🛠️ Executed Agentic Tools:</div>
              {prediction.tool_calls_executed.map((tc, idx) => (
                <div key={idx} style={{ margin: '2px 0' }}>
                  • <strong style={{ color: '#cbd5e1' }}>{tc.tool}</strong>: {JSON.stringify(tc.result).slice(0, 75)}...
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Officer Override Selection */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>
            Officer Decision / Override Choice:
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {ACTIONS.map((act) => (
              <button
                key={act}
                onClick={() => setSelectedAction(act)}
                style={{
                  flex: '1 1 auto',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: selectedAction === act ? '2px solid #38bdf8' : '1px solid #334155',
                  backgroundColor: selectedAction === act ? '#0284c7' : '#1e293b',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {act}
              </button>
            ))}
          </div>
        </div>

        {/* Optional Officer Notes */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>
            Officer Log Notes (For Continuous DPO Retraining):
          </label>
          <textarea
            value={officerNotes}
            onChange={(e) => setOfficerNotes(e.target.value)}
            placeholder="Add operational rationale for approval or override choice..."
            rows={3}
            style={{
              width: '100%',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '10px 12px',
              color: '#f8fafc',
              fontSize: '13px',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting || !isOverride}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isOverride ? '#f59e0b' : '#475569',
              color: '#ffffff',
              fontWeight: '700',
              cursor: isOverride ? 'pointer' : 'not-allowed',
              opacity: isSubmitting ? 0.6 : 1
            }}
          >
            Submit Override Decision
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
            style={{
              padding: '10px 22px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontWeight: '700',
              cursor: 'pointer',
              opacity: isSubmitting ? 0.6 : 1
            }}
          >
            Approve Qwen Action ({prediction.action})
          </button>
        </div>
      </div>
    </div>
  )
}
