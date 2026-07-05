'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Minus,
  Printer,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Nav } from '@/components/nav'

import { computePersonalBaseline, computeDeviation, describeDeviation } from '@/lib/adaptive-baseline'
import { generateTrendSummary, formatSessionDate } from '@/lib/narrative-engine'
import { getSessions } from '@/lib/storage'
import type { SessionEvent } from '@/lib/types'

// ─── 工具函數 ──────────────────────────────────────────────────

function levelColors(level: SessionEvent['level'] | null) {
  if (level === 'smooth') return { bg: 'bg-[#2F855A]/15', text: 'text-[#2F855A]', border: 'border-[#2F855A]/30', dot: '#2F855A' }
  if (level === 'attention') return { bg: 'bg-[#D97706]/15', text: 'text-[#D97706]', border: 'border-[#D97706]/30', dot: '#D97706' }
  if (level === 'review') return { bg: 'bg-[#DC2626]/15', text: 'text-[#DC2626]', border: 'border-[#DC2626]/30', dot: '#DC2626' }
  return { bg: 'bg-[#6B7280]/10', text: 'text-[#6B7280]', border: 'border-[#6B7280]/20', dot: '#6B7280' }
}

function levelIcon(level: SessionEvent['level'] | null, size = 'h-6 w-6') {
  if (level === 'smooth') return <CheckCircle2 className={`${size} text-[#2F855A]`} aria-hidden="true" />
  if (level === 'attention') return <AlertTriangle className={`${size} text-[#D97706]`} aria-hidden="true" />
  if (level === 'review') return <XCircle className={`${size} text-[#DC2626]`} aria-hidden="true" />
  return <Minus className={`${size} text-[#6B7280]`} aria-hidden="true" />
}

function trafficLabel(level: SessionEvent['level'] | null): { short: string; desc: string } {
  if (level === 'smooth') return { short: '動作順暢', desc: '坐站速度與姿態均在合理範圍內' }
  if (level === 'attention') return { short: '略有偏移', desc: '速度或偏斜略超出個人近期均值，建議持續觀察' }
  if (level === 'review') return { short: '建議家人確認', desc: '本次測試出現明顯偏斜或動作過慢，建議由家人確認操作環境' }
  return { short: '無資料', desc: '' }
}

function trendIcon(delta: number) {
  if (Math.abs(delta) < 0.3) return <Minus className="h-4 w-4 text-[#6B7280]" />
  if (delta > 0) return <TrendingDown className="h-4 w-4 text-[#DC2626]" />
  return <TrendingUp className="h-4 w-4 text-[#2F855A]" />
}

// ─── 主頁面 ────────────────────────────────────────────────────

export default function FamilyPage() {
  const [sessions, setSessions] = useState<SessionEvent[]>([])

  useEffect(() => {
    queueMicrotask(() => setSessions(getSessions()))
  }, [])

  const trend = useMemo(() => generateTrendSummary(sessions), [sessions])
  const baseline = useMemo(() => computePersonalBaseline(sessions), [sessions])
  const latest = sessions[0] ?? null
  const latestDeviation = latest
    ? computeDeviation(
        { avgDurationSec: latest.avgDurationSec, tiltMaxDeg: latest.tiltMaxDeg, instabilityEvents: latest.instabilityEvents },
        baseline,
      )
    : null

  // 趨勢計算（最近 3 vs 前 3）
  const speedTrend = useMemo(() => {
    if (sessions.length < 4) return null
    const r = sessions.slice(0, 3).reduce((s, x) => s + x.avgDurationSec, 0) / 3
    const o = sessions.slice(3, 6).reduce((s, x) => s + x.avgDurationSec, 0) / Math.min(3, sessions.length - 3)
    return r - o
  }, [sessions])

  // 圖表資料
  const chartData = useMemo(
    () =>
      [...sessions]
        .reverse()
        .slice(-14)
        .map((s, i) => ({
          index: i + 1,
          date: formatSessionDate(s.timestamp).replace(/\d+:\d+/, '').trim(),
          avgSec: parseFloat(s.avgDurationSec.toFixed(2)),
          level: s.level,
          tilt: parseFloat(s.tiltMaxDeg.toFixed(1)),
        })),
    [sessions],
  )

  const [now] = useState(() => Date.now())

  // 週摘要
  const weekSessions = useMemo(
    () => sessions.filter((s) => new Date(s.timestamp).getTime() > now - 7 * 86400000),
    [sessions, now],
  )

  const printReport = () => window.print()

  const colors = levelColors(latest?.level ?? null)
  const label = trafficLabel(latest?.level ?? null)

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-[#F4EDE4]">
        <Nav />
        <main className="mx-auto max-w-3xl px-4 py-12 text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-[#D5C9BB]" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-black text-[#1F2937]">家屬照護摘要</h1>
          <p className="mt-3 text-sm leading-6 text-[#6B7280]">
            目前沒有可分析的測試紀錄。<br />
            請先完成一次坐站測試並儲存結果。
          </p>
          <Link
            href="/session"
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#2D5F5D] px-6 text-sm font-black text-white hover:bg-[#244C4A]"
          >
            前往測試
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4EDE4]">
      <Nav />

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5 print:px-0 print:py-0">

        {/* 頁面標題與列印按鈕 */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#1F2937]">家屬照護摘要</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              根據本機 {sessions.length} 筆紀錄自動生成 · 僅供居家觀察參考，不是醫療診斷
            </p>
          </div>
          <button
            onClick={printReport}
            className="print:hidden flex shrink-0 items-center gap-2 rounded-lg border border-[#D5C9BB] bg-[#FFFDF9] px-3 py-2 text-sm font-bold text-[#4B5563] hover:bg-[#EBE3D8]"
            aria-label="列印報告"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            列印 / 分享
          </button>
        </div>

        {/* 最新狀態卡 ── 交通燈號 */}
        <section
          className={`rounded-2xl border p-5 ${colors.bg} ${colors.border}`}
          aria-label="最新測試狀態"
        >
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              {levelIcon(latest?.level ?? null, 'h-12 w-12')}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-2xl font-black ${colors.text}`}>{label.short}</div>
              <div className="mt-0.5 text-sm text-[#4B5563]">{label.desc}</div>
              <div className="mt-1.5 text-xs text-[#9CA3AF]">
                最新測試：{formatSessionDate(latest!.timestamp)}
              </div>
            </div>
            {latestDeviation && baseline.isReady && (
              <div className="shrink-0 text-right">
                <div className={`text-lg font-black ${latestDeviation.avgDurationPct && latestDeviation.avgDurationPct > 5 ? 'text-[#DC2626]' : latestDeviation.avgDurationPct && latestDeviation.avgDurationPct < -5 ? 'text-[#2F855A]' : 'text-[#4B5563]'}`}>
                  {latestDeviation.avgDurationPct !== null
                    ? `${latestDeviation.avgDurationPct > 0 ? '+' : ''}${Math.round(latestDeviation.avgDurationPct)}%`
                    : '—'}
                </div>
                <div className="text-xs text-[#9CA3AF]">vs 個人均值</div>
              </div>
            )}
          </div>

          {/* 個人基準線偏離摘要 */}
          {latestDeviation && baseline.isReady && (
            <div className="mt-4 rounded-xl border border-white/60 bg-white/50 p-3 text-sm text-[#4B5563]">
              {describeDeviation(latestDeviation, baseline)}
            </div>
          )}
          {!baseline.isReady && (
            <div className="mt-4 rounded-xl border border-[#D5C9BB]/60 bg-white/40 p-3 text-xs text-[#9CA3AF]">
              累積 {baseline.n}/3 筆後，系統將顯示個人化趨勢比較（目前以文獻絕對基準判定）
            </div>
          )}
        </section>

        {/* 四格關鍵指標 */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="關鍵指標">
          {[
            {
              icon: Clock,
              label: '最新耗時',
              value: `${latest!.avgDurationSec.toFixed(1)}s / 次`,
              sub: '文獻正常 < 3.34s',
              warn: latest!.avgDurationSec > 3.34,
            },
            {
              icon: Activity,
              label: '偏斜角度',
              value: `${latest!.tiltMaxDeg.toFixed(0)}°`,
              sub: '留意 ≥ 20°',
              warn: latest!.tiltMaxDeg >= 20,
            },
            {
              icon: AlertTriangle,
              label: '本週晃動',
              value: `${weekSessions.reduce((s, x) => s + x.instabilityEvents, 0)} 次`,
              sub: `共 ${weekSessions.length} 次測試`,
              warn: weekSessions.reduce((s, x) => s + x.instabilityEvents, 0) > 3,
            },
            {
              icon: BarChart3,
              label: '本週留意',
              value: `${weekSessions.filter(s => s.level !== 'smooth').length} / ${weekSessions.length}`,
              sub: '次留意或建議確認',
              warn: weekSessions.filter(s => s.level !== 'smooth').length > 1,
            },
          ].map(({ icon: Icon, label, value, sub, warn }) => (
            <div
              key={label}
              className={`rounded-xl border p-4 ${warn ? 'border-[#D97706]/30 bg-[#D97706]/5' : 'border-[#D5C9BB] bg-[#FFFDF9]'}`}
            >
              <Icon className={`h-5 w-5 ${warn ? 'text-[#D97706]' : 'text-[#6B7280]'}`} aria-hidden="true" />
              <div className="mt-2 text-lg font-black text-[#1F2937]">{value}</div>
              <div className="text-[10px] font-bold text-[#6B7280]">{label}</div>
              <div className="mt-0.5 text-[9px] text-[#9CA3AF]">{sub}</div>
            </div>
          ))}
        </section>

        {/* 速度趨勢圖 */}
        {chartData.length >= 2 && (
          <section className="rounded-2xl border border-[#D5C9BB] bg-[#FFFDF9] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-[#1F2937]">坐站速度趨勢</div>
                <div className="mt-0.5 text-xs text-[#9CA3AF]">每次平均耗時（秒），越低越好</div>
              </div>
              {speedTrend !== null && (
                <div className="flex items-center gap-1 rounded-lg border border-[#D5C9BB] bg-[#F4EDE4] px-3 py-1.5">
                  {trendIcon(speedTrend)}
                  <span className="text-xs font-bold text-[#4B5563]">
                    {Math.abs(speedTrend) < 0.3
                      ? '趨勢穩定'
                      : speedTrend > 0
                      ? `慢了 ${speedTrend.toFixed(1)}s`
                      : `快了 ${Math.abs(speedTrend).toFixed(1)}s`}
                  </span>
                </div>
              )}
            </div>

            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D5" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #D5C9BB', backgroundColor: '#FFFDF9', fontSize: 12 }}
                  formatter={(v: number) => [`${v.toFixed(2)}s`, '平均耗時']}
                />
                {/* 文獻高風險線 */}
                <ReferenceLine
                  y={3.34}
                  stroke="#DC2626"
                  strokeDasharray="4 4"
                  label={{ value: '文獻高風險線 3.34s', position: 'right', fontSize: 9, fill: '#DC2626' }}
                />
                {/* 個人基準線 */}
                {baseline.isReady && baseline.avgDuration && (
                  <ReferenceLine
                    y={parseFloat(baseline.avgDuration.mean.toFixed(2))}
                    stroke="#2D5F5D"
                    strokeDasharray="3 3"
                    label={{ value: `個人均值 ${baseline.avgDuration.mean.toFixed(1)}s`, position: 'right', fontSize: 9, fill: '#2D5F5D' }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="avgSec"
                  stroke="#2D5F5D"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#2D5F5D', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </section>
        )}

        {/* 趨勢文字摘要 */}
        <section className="rounded-2xl border border-[#D5C9BB] bg-[#FFFDF9] p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-[#2D5F5D]" aria-hidden="true" />
            <span className="text-sm font-black text-[#1F2937]">照護人員觀察摘要</span>
          </div>
          <p className="text-sm leading-7 text-[#4B5563]">{trend.narrative}</p>

          {/* 照護建議 */}
          <div className="mt-4 space-y-2">
            {latest!.level === 'review' && (
              <div className="rounded-xl border border-[#DC2626]/20 bg-[#DC2626]/5 p-3 text-sm text-[#4B5563]">
                <span className="font-black text-[#DC2626]">建議行動：</span>
                建議家人確認操作環境安全。若持續出現明顯偏移，建議安排物理治療師評估。
              </div>
            )}
            {latest!.level === 'attention' && (
              <div className="rounded-xl border border-[#D97706]/20 bg-[#D97706]/5 p-3 text-sm text-[#4B5563]">
                <span className="font-black text-[#D97706]">建議行動：</span>
                增加觀察頻率，留意是否在疲累或特定時段表現較差。若連續 3 次，考慮諮詢物理治療師。
              </div>
            )}
            {latest!.level === 'smooth' && (
              <div className="rounded-xl border border-[#2F855A]/20 bg-[#2F855A]/5 p-3 text-sm text-[#4B5563]">
                <span className="font-black text-[#2F855A]">持續觀察：</span>
                目前整體動作順暢。建議保持每週 2–3 次規律測試，追蹤長期的體能變化。
              </div>
            )}
          </div>
        </section>

        {/* 最近 5 筆明細 */}
        <section className="rounded-2xl border border-[#D5C9BB] bg-[#FFFDF9] p-5">
          <div className="mb-3 text-sm font-black text-[#1F2937]">最近紀錄明細</div>
          <div className="space-y-2">
            {sessions.slice(0, 5).map((s, i) => {
              const c = levelColors(s.level)
              const l = trafficLabel(s.level)
              return (
                <div key={s.id} className={`flex items-center gap-3 rounded-xl border p-3 ${i === 0 ? `${c.bg} ${c.border}` : 'border-[#E8E0D5]'}`}>
                  <div className="shrink-0">{levelIcon(s.level, 'h-5 w-5')}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black ${c.text}`}>{l.short}</span>
                      <span className="text-xs text-[#9CA3AF]">{formatSessionDate(s.timestamp)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-[#6B7280]">
                      均值 {s.avgDurationSec.toFixed(1)}s · 偏斜 {s.tiltMaxDeg.toFixed(0)}° · 晃動 {s.instabilityEvents} 次
                    </div>
                  </div>
                  {i === 0 && <span className="shrink-0 rounded-full bg-[#2D5F5D] px-2 py-0.5 text-[10px] font-black text-white">最新</span>}
                </div>
              )
            })}
          </div>
        </section>

        {/* 免責聲明 */}
        <div className="flex items-start gap-2 rounded-xl border border-[#D5C9BB] bg-[#FFFDF9] p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2D5F5D]" aria-hidden="true" />
          <p className="text-xs leading-5 text-[#9CA3AF]">
            本報告由 CareLoop 居家觀察工具自動生成，資料僅儲存於本機裝置，不上傳、不錄影。
            所有判定為居家動作觀察參考，不取代物理治療師或醫師的專業評估。
          </p>
        </div>

        {/* 跳轉按鈕 */}
        <div className="flex gap-3 pb-4 print:hidden">
          <Link
            href="/history"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#D5C9BB] bg-[#FFFDF9] py-3 text-sm font-black text-[#4B5563] hover:bg-[#EBE3D8]"
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            完整歷史紀錄
          </Link>
          <Link
            href="/session"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2D5F5D] py-3 text-sm font-black text-white hover:bg-[#244C4A]"
          >
            開始新測試
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </main>
    </div>
  )
}
