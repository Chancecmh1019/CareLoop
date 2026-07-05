import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CareLoop 安步 | 居家動作觀察與照護提醒',
  description:
    'CareLoop 安步是一套隱私優先的居家坐站動作觀察與照護提醒工具。',
  keywords: ['CareLoop 安步', '居家照護', '坐站測試', '姿態分析', '照護提醒'],
}

export const viewport: Viewport = {
  themeColor: '#2D5F5D',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}
