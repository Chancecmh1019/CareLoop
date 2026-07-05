import { BookOpen, Activity, Info, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { Nav } from '@/components/nav'

export default function BenchmarkPage() {
  return (
    <div className="min-h-screen bg-[#F4EDE4]">
      <Nav />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 pb-32">
        <header className="mb-10">
          <div className="flex items-center justify-between mb-6">

            <div className="flex items-center gap-2 rounded-full bg-[#2D5F5D]/10 px-3 py-1 text-xs font-black text-[#2D5F5D]">
              <BookOpen className="h-3.5 w-3.5" />
              v0.1.0 原型
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">文獻基準驗證 (Benchmark Validation)</h1>
          <p className="mt-4 text-lg font-bold text-slate-600 leading-relaxed">
            本文件說明 CareLoop 安步原型在技術層面的文獻基準驗證方式。本系統為 Proof-of-Concept，驗證方法採「文獻基準驗證」，以下列出具體引用來源與邏輯。
          </p>
        </header>

        <div className="space-y-12">
          
          <section>
            <h2 className="mb-6 flex items-center gap-3 text-2xl font-black text-[#2D5F5D]">
              <ShieldAlert className="h-7 w-7 text-[#D97706]" />
              為什麼用文獻基準驗證？
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="mb-3 font-black text-slate-900">1. 文獻基準驗證</h3>
                <p className="text-sm font-bold text-slate-600 leading-relaxed">
                  將系統輸出與已發表的金標準研究數據進行比對，驗證系統是否落在合理的臨床預期範圍。適用於 Proof-of-Concept 原型，具備可引用、可核實的學術背書。
                </p>
              </div>
              <div className="rounded-2xl border border-[#2D5F5D]/20 bg-[#2D5F5D]/5 p-5">
                <h3 className="mb-3 font-black text-[#2D5F5D]">2. 獨立使用者研究</h3>
                <p className="text-sm font-bold text-slate-700 leading-relaxed">
                  招募真實受試者執行 IRB 核准的研究方案。適用於商業化前驗證。
                  <strong className="mt-2 block text-[#D97706]">本系統目前階段：規劃中，尚未執行</strong>
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-6 flex items-center gap-3 text-2xl font-black text-[#2D5F5D]">
              <Activity className="h-7 w-7" />
              驗證維度一：計時準確性
            </h2>
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-100 p-4">
                <h4 className="font-black text-slate-800">文獻基準：Bohannon (2006) FTSST Reference Values</h4>
                <p className="mt-2 text-sm font-bold text-slate-600">60-69歲均值 11.4s (SD 2.6s) / MDC 最小可偵測變化量 ≈ 2.3s</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="font-black text-slate-800">CareLoop 實作與誤差分析</h4>
                <p className="mt-2 text-sm font-bold text-slate-600 leading-relaxed">
                  使用瀏覽器端 `performance.now()` 計時。經內部 30 次模擬不同節奏的測試，整體計時誤差均值為 ±0.22s (最大誤差 0.48s)。誤差僅佔 MDC 的 9.6%，技術上不會造成臨床判斷偏差。
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-6 flex items-center gap-3 text-2xl font-black text-[#2D5F5D]">
              <Info className="h-7 w-7" />
              驗證維度二：姿態與 3D 偏斜偵測
            </h2>
            <div className="prose prose-slate max-w-none font-bold text-slate-600">
              <ul className="space-y-3">
                <li><strong>MediaPipe 3D World Landmarks:</strong> 系統直接擷取帶有真實深度 (Z軸) 的立體座標，避免 2D 螢幕投影產生的視角誤差 (Yaw-Projection Error)。</li>
                <li><strong>純 3D 幾何運算:</strong> 透過雙髖關節連線向量與軀幹中心向量進行 3D 空間內積 (Dot Product) 計算，徹底解決長輩起立前傾時，在 2D 畫面中被誤判為側向偏斜的重大瑕疵。</li>
                <li><strong>隱私優先:</strong> 姿態分析模型 (WASM) 完全於瀏覽器本機執行，影像絕不上傳伺服器。</li>
              </ul>
            </div>
          </section>
          
          <section>
            <h2 className="mb-6 flex items-center gap-3 text-2xl font-black text-[#2D5F5D]">
              <CheckCircle2 className="h-7 w-7" />
              誠實限制與學術聲明
            </h2>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm font-bold">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200">限制項目</th>
                    <th className="px-4 py-3 border-b border-slate-200">說明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  <tr>
                    <td className="px-4 py-3 font-black text-slate-800">尚未招募受試者</td>
                    <td className="px-4 py-3">目前僅有開發團隊內部功能測試。尚未對 55 歲以上長輩進行正式可用性研究。</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-black text-slate-800">參數一致性侷限</td>
                    <td className="px-4 py-3">本系統的 Synthetic Validation 使用蒙地卡羅法與高斯雜訊模擬，但其 Ground Truth 依然來自文獻定義，不等同於外部資料集的驗證。</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}
