import { ShieldCheck } from 'lucide-react'

export function PrivacyBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-lg border border-[#2D5F5D]/25 bg-[#E8F2EF] p-3 text-[#244C4A]">
      <div className="flex gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className={compact ? 'text-xs font-bold leading-5' : 'text-sm font-bold leading-6'}>
          本系統不會錄製或儲存您的影像，僅在瀏覽器端即時分析動作數據。
        </p>
      </div>
    </div>
  )
}
