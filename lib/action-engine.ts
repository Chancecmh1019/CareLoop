import type { CoachAction, ObservationLevel } from '@/lib/types'

const statusSpeechText: Record<ObservationLevel | 'tracking-lost', string> = {
  smooth: '動作很穩，照這個節奏繼續。',
  attention: '我有看到一點晃動，先放慢，重心保持在身體中線。',
  review: '這次動作比較不穩，請先停一下，必要時請家人或專業人員協助。',
  'tracking-lost': '我看不到完整身體了，請回到鏡頭中央，讓頭、身體和腿都入鏡。',
}

const coachActionText: Record<CoachAction | 'realign', string> = {
  hold: '先坐穩，雙腳踩地，身體面向鏡頭。',
  stand: '現在站起來。慢慢站直，不要急。',
  sit: '很好，現在慢慢坐下，坐穩再開始下一次。',
  complete: '完成了，很好。先坐穩休息一下。',
  realign: '請回到鏡頭中央，讓全身都被拍到。',
}

function speak(text: string, options?: { interrupt?: boolean; rate?: number; pitch?: number }) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  if (options?.interrupt !== false) window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-TW'
  utterance.rate = options?.rate ?? 0.92
  utterance.pitch = options?.pitch ?? 1
  window.speechSynthesis.speak(utterance)
}

export function speakStatus(level: ObservationLevel | 'tracking-lost') {
  speak(statusSpeechText[level], { interrupt: true, rate: 0.92 })
}

export function speakCoachAction(action: CoachAction | 'realign', options?: { reps?: number; target?: number; interrupt?: boolean }) {
  const prefix =
    typeof options?.reps === 'number' && typeof options?.target === 'number' && action !== 'hold' && action !== 'complete' && action !== 'realign'
      ? `第 ${Math.min(options.reps + 1, options.target)} 次，`
      : ''
  speak(`${prefix}${coachActionText[action]}`, { interrupt: options?.interrupt ?? true, rate: 0.9, pitch: 1.03 })
}

export function vibrateStatus(level: ObservationLevel | 'tracking-lost') {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  const pattern = level === 'review' ? [180, 80, 180] : level === 'attention' ? [140] : [60]
  navigator.vibrate(pattern)
}

export function vibrateCoachAction(action: CoachAction | 'realign') {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  const pattern = action === 'sit' ? [80, 60, 80] : action === 'stand' ? [140] : action === 'realign' ? [180, 80, 180] : [50]
  navigator.vibrate(pattern)
}

export function notifyStatus(level: ObservationLevel | 'tracking-lost', options?: { speech?: boolean; vibration?: boolean }) {
  if (options?.speech !== false) speakStatus(level)
  if (options?.vibration !== false) vibrateStatus(level)
}

export function notifyCoachAction(action: CoachAction | 'realign', options?: { reps?: number; target?: number; speech?: boolean; vibration?: boolean; interrupt?: boolean }) {
  if (options?.speech !== false) speakCoachAction(action, options)
  if (options?.vibration !== false) vibrateCoachAction(action)
}
