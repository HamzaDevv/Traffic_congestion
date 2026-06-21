import CountUp from 'react-countup'

export default function StatsCards({ stats }) {
  if (!stats) return null

  const cards = [
    {
      id: 'total',
      label: 'Total Reports',
      value: stats.total_reports,
      decimals: 0,
      icon: '📋',
      accent: '#00e5ff',
      sub: 'Last 5 months',
    },
    {
      id: 'approved',
      label: 'Approved',
      value: stats.approval_rate,
      decimals: 1,
      suffix: '%',
      icon: '✅',
      accent: '#00e676',
      sub: `${stats.approved_count} valid reports`,
    },
    {
      id: 'severity',
      label: 'Avg Severity',
      value: stats.avg_severity * 100,
      decimals: 1,
      suffix: '%',
      icon: '⚡',
      accent: '#ff9100',
      sub: 'ML-predicted impact',
    },
    {
      id: 'clusters',
      label: 'Hotspot Zones',
      value: stats.num_clusters,
      decimals: 0,
      icon: '🔥',
      accent: '#ff1744',
      sub: 'Active dispatch targets',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      {cards.map(card => (
        <div
          key={card.id}
          className="glass-light rounded-xl p-3 kpi-card cursor-default"
          style={{ borderLeft: `2px solid ${card.accent}` }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider leading-tight">
              {card.label}
            </span>
            <span style={{ fontSize: '14px' }}>{card.icon}</span>
          </div>
          <div
            className="text-2xl font-bold leading-none mb-1"
            style={{ color: card.accent }}
          >
            <CountUp
              end={card.value}
              decimals={card.decimals}
              duration={1.5}
              suffix={card.suffix || ''}
              separator=","
            />
          </div>
          <div className="text-xs text-slate-500">{card.sub}</div>
        </div>
      ))}
    </div>
  )
}
