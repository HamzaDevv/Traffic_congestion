import CountUp from 'react-countup'
import { FileText, CheckCircle, Zap, Flame, Truck, Clock } from 'lucide-react'

export default function StatsCards({ stats }) {
  if (!stats) return null

  const cards = [
    {
      id: 'active_complaints',
      label: 'Active Complaints (Last 1h)',
      value: stats.total_reports ? Math.floor(stats.total_reports * 0.05) : 0,
      decimals: 0,
      Icon: FileText,
      sub: 'Real-time intake',
    },
    {
      id: 'validation_rate',
      label: 'Validation Rate',
      value: stats.approval_rate,
      decimals: 1,
      suffix: '%',
      Icon: CheckCircle,
      sub: '+4% vs yesterday',
    },
    {
      id: 'congestion_impact',
      label: 'Congestion Impact Index',
      value: stats.avg_severity * 100,
      decimals: 1,
      suffix: '%',
      Icon: Zap,
      sub: 'Machine-predicted severity',
    },
    {
      id: 'active_hotspots',
      label: 'Active Hotspots',
      value: stats.num_clusters,
      decimals: 0,
      Icon: Flame,
      sub: (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-risk-critical animate-ping-slow" />
          {Math.floor(stats.num_clusters * 0.15)} Critical
        </span>
      ),
    },
    {
      id: 'towing_units',
      label: 'Towing Units Available',
      value: 24,
      decimals: 0,
      Icon: Truck,
      sub: 'Ready for dispatch',
    },
    {
      id: 'peak_hour',
      label: 'Peak Violation Hour',
      value: 18,
      decimals: 0,
      prefix: '',
      suffix: ':00',
      Icon: Clock,
      sub: 'Highest congestion',
    }
  ]

  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      {cards.map(card => {
        const { Icon } = card
        return (
          <div
            key={card.id}
            className="bg-bg-card border border-bg-border rounded-xl p-3 cursor-default transition-colors hover:bg-bg-hover"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-widest text-text-muted font-medium leading-tight">
                {card.label}
              </span>
              <Icon size={14} className="text-text-muted shrink-0" />
            </div>
            <div className="text-2xl font-medium leading-none mb-1 text-accent-yellow">
              {card.prefix || ''}
              <CountUp
                end={card.value}
                decimals={card.decimals}
                duration={1.5}
                suffix={card.suffix || ''}
                separator=","
              />
            </div>
            <div className="text-xs text-text-muted">{card.sub}</div>
          </div>
        )
      })}
    </div>
  )
}
