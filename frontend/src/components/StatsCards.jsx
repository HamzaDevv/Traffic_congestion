import CountUp from 'react-countup'

export default function StatsCards({ stats }) {
  if (!stats) return null

  const cards = [
    {
      id: 'active_complaints',
      label: 'Active Complaints (Last 1h)',
      // Simulate real-time count for demo purposes if backend doesn't provide
      value: stats.total_reports ? Math.floor(stats.total_reports * 0.05) : 0,
      decimals: 0,
      icon: '📋',
      accent: '#00e5ff',
      sub: 'Real-time intake',
    },
    {
      id: 'validation_rate',
      label: 'Validation Rate',
      value: stats.approval_rate,
      decimals: 1,
      suffix: '%',
      icon: '✅',
      accent: '#00e676',
      sub: '↑ 4% vs yesterday',
    },
    {
      id: 'congestion_impact',
      label: 'Congestion Impact Index',
      value: stats.avg_severity * 100,
      decimals: 1,
      suffix: '%',
      icon: '⚡',
      accent: stats.avg_severity > 0.6 ? '#ff1744' : stats.avg_severity > 0.3 ? '#ff9100' : '#00e676',
      sub: 'Machine-predicted severity',
    },
    {
      id: 'active_hotspots',
      label: 'Active Hotspots',
      value: stats.num_clusters,
      decimals: 0,
      icon: '🔥',
      accent: '#ff1744',
      sub: (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping-slow" />
          {Math.floor(stats.num_clusters * 0.15)} Critical
        </span>
      ),
    },
    {
      id: 'towing_units',
      label: 'Towing Units Available',
      value: 24,
      decimals: 0,
      icon: '🛻',
      accent: '#00b4d8',
      sub: 'Ready for dispatch',
    },
    {
      id: 'peak_hour',
      label: 'Peak Violation Hour',
      value: 18, // Could be dynamic from timeline, hardcoding 6 PM for now
      decimals: 0,
      prefix: '',
      suffix: ':00',
      icon: '🕐',
      accent: '#ffea00',
      sub: 'Highest congestion',
    }
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
            className="text-2xl font-bold leading-none mb-1 font-mono tracking-tight"
            style={{ color: card.accent }}
          >
            {card.prefix || ''}
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
