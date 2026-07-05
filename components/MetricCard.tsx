import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'

export function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'smooth' | 'attention' | 'review'
}) {
  return (
    <div className="rounded-lg border border-[#D5C9BB] bg-[#FFFDF9] p-4">
      <div className="flex items-center gap-2 text-[#6B7280]">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-black">{label}</span>
      </div>
      <div
        className={cn(
          'mt-2 text-2xl font-black tabular-nums',
          tone === 'smooth' && 'text-[#2F855A]',
          tone === 'attention' && 'text-[#D97706]',
          tone === 'review' && 'text-[#DC2626]',
          tone === 'default' && 'text-[#1F2937]',
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs leading-5 text-[#6B7280]">{sub}</div>}
    </div>
  )
}
