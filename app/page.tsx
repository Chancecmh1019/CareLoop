import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Camera,
  GitMerge,
  HeartPulse,
  MessageSquareText,
  Mic2,
  ShieldCheck,
  Smartphone,
  Zap,
} from 'lucide-react'
import { Nav } from '@/components/nav'

const features = [
  {
    icon: Camera,
    title: '本機姿態分析',
    desc: 'MediaPipe Pose Landmarker 在瀏覽器端即時運算 33 個人體關鍵點。影像不錄製、不儲存、不上傳。',
  },
  {
    icon: Smartphone,
    title: '雙模態感測融合',
    desc: '視覺模態（骨架偵測）＋慣性模態（陀螺儀加速度計）互補驗證，降低單模態誤報率。',
  },
  {
    icon: Mic2,
    title: '即時語音指導',
    desc: '系統主動以語音告知具體指令，形成感知→決策→行動的完整閉環回饋。',
  },
  {
    icon: HeartPulse,
    title: '個人化自適應基準線',
    desc: '累積 3 筆後自動建立個人均值 ± SD，往後每次測試顯示「比您的近期平均慢 18%」。',
  },
  {
    icon: MessageSquareText,
    title: '家屬問答引擎',
    desc: '支援時間感知（今天、昨天、本週）、趨勢分析與照護建議。規則式引擎，零 API 費用。',
  },
  {
    icon: Activity,
    title: '縱向趨勢追蹤',
    desc: '累積多次測試後自動顯示趨勢圖，並標示 Bohannon 2006 文獻對照線。',
  },
]

const PIPELINE = [
  {
    step: '感知',
    en: 'Perception',
    color: '#4EB8B4',
    items: ['MediaPipe 骨架（33點）', '陀螺儀加速度計', '雙模態融合驗證'],
  },
  {
    step: '分析',
    en: 'Analysis',
    color: '#2D5F5D',
    items: ['坐站狀態機', '偏斜 / 晃動評估', '個人化基準線比較'],
  },
  {
    step: '行動',
    en: 'Action',
    color: '#D97706',
    items: ['即時語音指導', '視覺引導箭頭', '觸覺震動回饋'],
  },
  {
    step: '洞察',
    en: 'Insight',
    color: '#2F855A',
    items: ['個人趨勢圖表', '家屬問答引擎', '文獻基準對比'],
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F4EDE4]">
      <Nav />
      <main>
        {/* Hero */}
        <section className="mx-auto grid min-h-[calc(100dvh-64px)] w-full max-w-6xl items-center gap-8 px-4 py-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-2xl">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-lg border border-[#2D5F5D]/25 bg-[#FFFDF9] px-3 py-2 text-sm font-bold text-[#2D5F5D]">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Accessible AI · 零成本跨越數位落差
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg border border-[#D97706]/30 bg-[#FFFDF9] px-3 py-2 text-sm font-bold text-[#D97706]">
                <Activity className="h-4 w-4" aria-hidden="true" />
                Privacy by Constraint · 極致本機運算
              </span>
            </div>
            <h1 className="text-balance text-4xl font-black leading-tight text-[#1F2937] sm:text-6xl">
              CareLoop 安步
            </h1>
            <p className="mt-3 text-lg font-bold text-[#2D5F5D]">
              專為偏鄉與弱勢家庭設計的零硬體居家動作觀察工具
            </p>
            <p className="mt-4 max-w-xl text-lg leading-8 text-[#4B5563]">
              把需要十萬元設備的動作分析，降低到零成本。CareLoop 運用家中既有的手機，將開源 AI 模型化為照護工具。系統完全在手機本機運算，不依賴網路、不上傳影像，讓偏鄉與資源有限的家庭也能享有專業級的自我健康追蹤。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/session" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#2D5F5D] px-6 text-base font-black text-white shadow-lg hover:bg-[#244C4A]">
                開始測試
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link href="/validation" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#D5C9BB] bg-[#FFFDF9] px-6 text-base font-black text-[#1F2937] hover:bg-[#EBE3D8]">
                <Zap className="h-5 w-5 text-[#2D5F5D]" aria-hidden="true" />
                算法驗證
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-[#D5C9BB] bg-[#FFFDF9] p-4 shadow-sm">
                <Icon className="mb-3 h-7 w-7 text-[#2D5F5D]" aria-hidden="true" />
                <div className="text-sm font-black text-[#1F2937]">{title}</div>
                <p className="mt-1.5 text-xs leading-5 text-[#6B7280]">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 技術架構管線 */}
        <section className="border-t border-[#D5C9BB] bg-[#FFFDF9] py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-10 text-center">
              <div className="inline-flex items-center gap-2 rounded-lg border border-[#2D5F5D]/20 px-3 py-1.5 text-sm font-bold text-[#2D5F5D]">
                <GitMerge className="h-4 w-4" />
                感知 → 分析 → 行動 → 洞察
              </div>
              <p className="mt-2 text-sm text-[#6B7280]">AI 輔助自我覺察四層架構</p>
              <h2 className="mt-4 text-3xl font-black text-[#1F2937]">系統技術架構</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE.map(({ step, en, color, items }) => (
                <div key={step} className="rounded-2xl border border-[#D5C9BB] bg-[#F4EDE4] p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-white" style={{ background: color }}>
                      {step}
                    </span>
                    <span className="text-xs font-bold text-[#6B7280]">{en}</span>
                  </div>
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs leading-5 text-[#4B5563]">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* 個人化基準線說明 */}
            <div className="mt-8 rounded-2xl border border-[#2D5F5D]/20 bg-[#2D5F5D]/5 p-6 md:p-8">
              <div className="grid gap-6 md:grid-cols-2 md:items-center">
                <div>
                  <p className="text-xs font-black text-[#2D5F5D] mb-2">核心創新：N-of-1 個人化監測</p>
                  <h3 className="text-lg font-black text-[#1F2937]">個人自適應基準線</h3>
                  <p className="mt-3 text-sm leading-7 text-[#4B5563]">
                    傳統系統只告訴你「你比全體平均差」。CareLoop 累積 3 筆後，為您建立個人均值 ± 標準差基準線。80 歲長輩的「正常」和 65 歲長輩不同，因此我們追蹤的是「您今天比自己的平均慢了多少」，而不是和全體人口比較。
                  </p>
                  <p className="mt-2 text-xs text-[#6B7280]">
                    對應 Minimal Detectable Change 概念（Perera et al., 2006 Physical Therapy）
                  </p>
                </div>
                <div className="rounded-xl border border-[#2D5F5D]/20 bg-[#FFFDF9] p-5">
                  <div className="space-y-3 text-sm">
                    <div className="rounded-lg border border-[#E5DCCF] p-3">
                      <span className="text-xs font-black text-[#DC2626]">傳統方式</span>
                      <div className="mt-1 font-black text-[#1F2937]">平均 &gt; 3.34s → 明顯偏慢</div>
                      <div className="mt-0.5 text-xs text-[#9CA3AF]">所有人用同一個閾值</div>
                    </div>
                    <div className="rounded-lg border border-[#2D5F5D]/20 p-3">
                      <span className="text-xs font-black text-[#2D5F5D]">CareLoop</span>
                      <div className="mt-1 font-black text-[#1F2937]">比您的近期平均慢 18%</div>
                      <div className="mt-0.5 text-xs text-[#9CA3AF]">個人均值 ± 2SD 自適應</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>



        {/* 驗證數據橫幅 */}
        <section className="border-t border-[#D5C9BB] bg-[#FFFDF9] py-14">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-8 text-center">
              <p className="text-xs font-black text-[#2D5F5D]">Parameter Consistency Test</p>
              <h2 className="mt-2 text-2xl font-black text-[#1F2937]">Monte Carlo 參數一致性測試結果</h2>
              <p className="mt-2 text-sm text-[#6B7280]">
                以 Bohannon (2006) 臨床常態分佈參數生成 1,000 位合成患者，並以已發表臨床閾值作為 Ground Truth 比對軟體決策邏輯
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { value: '≥ 85%', label: '整體一致率', sub: '1,000 位合成患者', color: '#2D5F5D' },
                { value: '≥ 0.75', label: "Cohen's κ", sub: '實質一致以上', color: '#2D5F5D' },
                { value: '≥ 92%', label: '需留意分類 Recall', sub: '「需陪同」類別', color: '#2F855A' },
                { value: '< 0.22s', label: '計時誤差均值', sub: 'MDC 的 9.6%', color: '#2D5F5D' },
              ].map(({ value, label, sub, color }) => (
                <div key={label} className="rounded-2xl border border-[#D5C9BB] bg-[#F4EDE4] p-5 text-center">
                  <div className="text-3xl font-black" style={{ color }}>{value}</div>
                  <div className="mt-1.5 text-sm font-black text-[#1F2937]">{label}</div>
                  <div className="mt-0.5 text-xs text-[#9CA3AF]">{sub}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 text-center">
              <Link
                href="/validation"
                className="inline-flex items-center gap-2 rounded-lg border border-[#2D5F5D]/30 bg-[#2D5F5D]/5 px-4 py-2 text-sm font-bold text-[#2D5F5D] hover:bg-[#2D5F5D]/10"
              >
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                查看完整驗證報告（可當場重跑模擬）
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[#D5C9BB] bg-[#FFFDF9] py-16 text-center">
          <div className="mx-auto max-w-xl px-4">
            <h2 className="text-2xl font-black text-[#1F2937]">開始追蹤您的動作表現</h2>
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">
              累積 3 次測試後，系統自動建立您的個人基準線。<br />
              只需要手機，無需購買任何裝置。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/session" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#2D5F5D] px-6 text-sm font-black text-white shadow hover:bg-[#244C4A]">
                前往測試頁
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/validation" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#D5C9BB] bg-[#F4EDE4] px-6 text-sm font-black text-[#1F2937] hover:bg-[#EBE3D8]">
                算法驗證報告
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
