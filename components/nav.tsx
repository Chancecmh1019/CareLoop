'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, BarChart2, BarChart3, FlaskConical, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

// 主要流程步驟（左側突出顯示）
const flowSteps = [
  { href: '/session', label: '測試', icon: Activity, step: '1' },
  { href: '/history', label: '紀錄', icon: BarChart2, step: '2' },
  { href: '/family', label: '摘要', icon: BarChart3, step: '3' },
]

// 輔助頁面（右側，較小）
const auxLinks = [
  { href: '/validation', label: '驗證', icon: FlaskConical },
  { href: '/privacy', label: '隱私', icon: ShieldCheck },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-[#D5C9BB] bg-[#FFFDF9]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2">
        {/* Logo */}
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2" aria-label="CareLoop 安步首頁">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2D5F5D] text-sm font-black text-white">
            CL
          </span>
          <span className="hidden min-w-0 font-black text-[#1F2937] sm:block">
            CareLoop <span className="text-[#2D5F5D]">安步</span>
          </span>
        </Link>

        {/* 主要流程步驟 */}
        <nav className="flex items-center gap-1" aria-label="測試流程">
          {flowSteps.map(({ href, label, icon: Icon, step }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-black transition-colors',
                  active
                    ? 'bg-[#2D5F5D] text-white'
                    : 'text-[#6B7280] hover:bg-[#EBE3D8] hover:text-[#1F2937]',
                )}
              >
                <span className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black',
                  active ? 'bg-white/20 text-white' : 'bg-[#E5DCCF] text-[#6B7280]',
                )}>
                  {step}
                </span>
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* 輔助頁面 */}
        <nav className="flex items-center gap-1" aria-label="其他功能">
          {auxLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                title={label}
                className={cn(
                  'flex min-h-10 min-w-10 items-center justify-center rounded-lg px-2 text-xs font-bold transition-colors',
                  active
                    ? 'bg-[#2D5F5D] text-white'
                    : 'text-[#9CA3AF] hover:bg-[#EBE3D8] hover:text-[#1F2937]',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="ml-1 hidden sm:inline">{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* 流程指示條（僅在流程頁面顯示）*/}
      {flowSteps.some(s => pathname.startsWith(s.href)) && (
        <div className="flex h-0.5 w-full">
          {flowSteps.map(({ href }) => (
            <div
              key={href}
              className={cn(
                'flex-1 transition-colors duration-300',
                pathname.startsWith(href) ? 'bg-[#2D5F5D]' : 'bg-[#E5DCCF]',
              )}
            />
          ))}
        </div>
      )}
    </header>
  )
}
