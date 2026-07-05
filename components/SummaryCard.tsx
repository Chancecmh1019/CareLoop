import { Activity, Clock, MoveHorizontal } from 'lucide-react'
import { levelLabel } from '@/lib/decision-engine'
import { formatSessionDate, generateSessionSummary } from '@/lib/narrative-engine'
import type { SessionEvent } from '@/lib/types'
import { cn } from '@/lib/utils'

const levelClass = {
  smooth:    'border-[#2F855A]/35 bg-[#EAF6EE] text-[#245E3E]',
  attention: 'border-[#D97706]/35 bg-[#FFF4DF] text-[#92400E]',
  review:    'border-[#DC2626]/35 bg-[#FEECEC] text-[#991B1B]',
}

export function SummaryCard({ session, index }: { session: SessionEvent; index?: number }) {
  return (
    <article className="rounded-lg border border-[#D5C9BB] bg-[#FFFDF9] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-black text-[#1F2937]">
            {index !== undefined ? `第 ${index + 1} 筆` : '測試紀錄'}
          </h3>
          <p className="mt-0.5 text-sm text-[#6B7280]">{formatSessionDate(session.timestamp)}</p>
        </div>
        <span className={cn('rounded-lg border px-2.5 py-1 text-xs font-black', levelClass[session.level])}>
          {levelLabel(session.level)}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-[#EBE3D8] p-2">
          <Activity className="h-4 w-4 text-[#2D5F5D]" aria-hidden="true" />
          <div className="mt-1 font-black">{session.reps}/5</div>
          <div className="text-xs text-[#6B7280]">次數</div>
        </div>
        <div className="rounded-lg bg-[#EBE3D8] p-2">
          <Clock className="h-4 w-4 text-[#2D5F5D]" aria-hidden="true" />
          <div className="mt-1 font-black">{session.totalDurationSec.toFixed(1)}s</div>
          <div className="text-xs text-[#6B7280]">耗時</div>
        </div>
        <div className="rounded-lg bg-[#EBE3D8] p-2">
          <MoveHorizontal className="h-4 w-4 text-[#2D5F5D]" aria-hidden="true" />
          <div className="mt-1 font-black">{session.instabilityEvents}</div>
          <div className="text-xs text-[#6B7280]">晃動</div>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#4B5563]">{generateSessionSummary(session)}</p>
    </article>
  )
}
