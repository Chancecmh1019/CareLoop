import { Activity, Database, FileText, LockKeyhole, ShieldCheck, VideoOff } from 'lucide-react'
import { Nav } from '@/components/nav'

const sections = [
  {
    icon: VideoOff,
    title: '影像不錄製、不保存',
    body: '攝影機畫面僅用於即時姿態分析，分析在您的裝置本機完成。系統不會錄製、儲存或上傳任何影像或影片畫面。',
  },
  {
    icon: Activity,
    title: '只保存數值化結果',
    body: '系統僅保存數值化的測試結果，例如完成次數、耗時、偏斜角度與晃動事件。',
  },
  {
    icon: Database,
    title: '資料只在瀏覽器本機',
    body: '所有歷史紀錄僅儲存在您使用的瀏覽器本機，不會同步到任何雲端伺服器。',
  },
  {
    icon: LockKeyhole,
    title: '可自行清除或匯出',
    body: '您可以在歷史頁清除本機紀錄，也可以匯出 JSON 檔案作為個人備份。',
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F4EDE4]">
      <Nav />

      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-[#D5C9BB] bg-[#FFFDF9] p-6">
          <ShieldCheck className="h-8 w-8 text-[#2D5F5D]" aria-hidden="true" />
          <h1 className="mt-4 text-3xl font-black text-[#1F2937]">隱私與非醫療聲明</h1>
          <p className="mt-3 text-base leading-8 text-[#4B5563]">
            CareLoop 重視您的隱私與尊嚴。系統以「本機分析、數值保存、無雲端同步」為原則。
          </p>
        </div>

        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          {sections.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-lg border border-[#D5C9BB] bg-[#FFFDF9] p-5">
              <Icon className="h-6 w-6 text-[#2D5F5D]" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-black text-[#1F2937]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">{body}</p>
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-lg border border-[#D97706]/30 bg-[#FFF8EA] p-5">
          <FileText className="h-6 w-6 text-[#D97706]" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-black text-[#92400E]">非醫療診斷聲明</h2>
          <p className="mt-2 text-sm leading-7 text-[#92400E]">
            CareLoop 是一套居家動作觀察與照護提醒工具，不是醫療診斷產品。系統不會判斷任何疾病、不會取代醫師或物理治療師的專業評估。若您或家人對身體狀況有疑慮，請諮詢專業醫療人員。
          </p>
        </section>
      </main>
    </div>
  )
}
