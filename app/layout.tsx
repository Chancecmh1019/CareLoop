import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CareLoop | 居家坐站與平衡觀察',
  description: 'CareLoop 使用瀏覽器端姿勢偵測，協助長輩在家完成坐站測驗與平衡觀察。',
  keywords: ['CareLoop', '坐站測驗', '平衡觀察', '長輩照護', '姿勢偵測'],
  icons: {
    icon: [{ url: '/old-people.svg', type: 'image/svg+xml' }],
    shortcut: ['/old-people.svg'],
  },
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
