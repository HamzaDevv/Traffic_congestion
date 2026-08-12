import React from 'react'

export default function ToolExecutionLog({ toolCalls, metrics }) {
  if (!toolCalls || toolCalls.length === 0) return null

  return (
    <div style={{
      backgroundColor: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '12px',
      padding: '16px',
      marginTop: '16px',
      color: '#f8fafc'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: '#38bdf8' }}>
          🛠️ Live Agentic Tool Execution Trace
        </h4>
        {metrics && (
          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>
            Autonomous Rate: {metrics.autonomous_resolution_rate_pct}%
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toolCalls.map((tc, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: '#1e293b',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '12px',
              borderLeft: '4px solid #0284c7'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: '#f8fafc', marginBottom: '4px' }}>
              <span>Function: {tc.tool}()</span>
              <span style={{ color: '#94a3b8', fontSize: '10px' }}>Executed</span>
            </div>
            <pre style={{
              margin: 0,
              fontSize: '11px',
              color: '#cbd5e1',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'monospace'
            }}>
              {JSON.stringify(tc.result, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
