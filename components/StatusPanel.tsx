import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { levelLabel } from '@/lib/decision-engine'
import type { ObservationLevel, TrackingQuality } from '@/lib/types'
import { cn } from '@/lib/utils'

export type SessionStatus = ObservationLevel | 'setup' | 'ready' | 'tracking-lost'

const meta: Record<SessionStatus, { label: string; body: string; icon: typeof Info; classes: string }> = {
  setup: {
    label: '準備開始',
    body: '開啟攝影機後，請讓全身在畫面中，並使用穩固椅子。',
    icon: Info,
    classes: 'border-[#D5C9BB] bg-[#FFFDF9] text-[#1F2937]',
  },
  ready: {
    label: '已就緒',
    body: '按下開始測試後，系統會觀察坐下、站起、再坐下的循環。',
    icon: CheckCircle2,
    classes: 'border-[#2D5F5D]/35 bg-[#E8F2EF] text-[#244C4A]',
  },
  smooth: {
    label: levelLabel('smooth'),
    body: '偵測到動作順暢，請保持相同節奏完成觀察。',
    icon: CheckCircle2,
    classes: 'border-[#2F855A]/35 bg-[#EAF6EE] text-[#245E3E]',
  },
  attention: {
    label: levelLabel('attention'),
    body: '偵測到輕度偏移或晃動，請放慢速度並留意左右平衡。',
    icon: AlertTriangle,
    classes: 'border-[#D97706]/35 bg-[#FFF4DF] text-[#92400E]',
  },
  review: {
    label: levelLabel('review'),
    body: '偵測到明顯偏移或晃動，建議家人確認環境安全。',
    icon: XCircle,
    classes: 'border-[#DC2626]/35 bg-[#FEECEC] text-[#991B1B]',
  },
  'tracking-lost': {
    label: '偵測訊號中斷',
    body: '請回到畫面中央，並確認光線充足。',
    icon: Info,
    classes: 'border-[#D5C9BB] bg-[#F3F4F6] text-[#374151]',
  },
}

export function StatusPanel({
  status,
  trackingQuality,
}: {
  status: SessionStatus
  trackingQuality?: TrackingQuality
}) {
  const resolved = trackingQuality === 'lost' ? meta['tracking-lost'] : meta[status]
  const Icon = resolved.icon

  return (
    <section className={cn('rounded-lg border p-4', resolved.classes)} aria-live="polite">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-black">{resolved.label}</h2>
          <p className="mt-1 text-sm leading-6">{resolved.body}</p>
        </div>
      </div>
    </section>
  )
}
