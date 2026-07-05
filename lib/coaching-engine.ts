export interface CoachingContext {
  shoulderTiltDeg: number | null
  lateralSwayMs2: number
  motionState: 'sitting' | 'standing' | 'moving' | 'unknown'
  lastRepSec: number
  reps: number
  trackingQuality: 'good' | 'poor' | 'lost'
}

export type CoachingEvent =
  | 'tilt_left'
  | 'tilt_right'
  | 'tilt_severe'
  | 'sway_detected'
  | 'too_fast'
  | 'rep_done'
  | 'realign'

const COACHING_SPEECH: Record<CoachingEvent, string> = {
  tilt_left: '重心往左帶回來一點，肩膀和骨盆對齊。',
  tilt_right: '重心往右帶回來一點，慢慢調整，不要急。',
  tilt_severe: '身體偏得比較多，先停一下，扶穩再繼續。',
  sway_detected: '我看到晃動了，下一次放慢一點，站穩再坐下。',
  too_fast: '速度太快了，請用穩定、可控制的節奏完成。',
  rep_done: '很好，這一次完成了，坐穩後準備下一次。',
  realign: '我看不到完整身體，請回到鏡頭中央。',
}

const THRESHOLDS = {
  TILT_MILD_DEG: 8,
  TILT_SEVERE_DEG: 15,
  SWAY_MS2: 1.5,
  TOO_FAST_SEC: 1.2,
  COOLDOWN_MS: 4000,
}

export function createCoachingEngine() {
  const lastPlayed = new Map<CoachingEvent, number>()
  let lastRepSpoken = 0

  function canPlay(event: CoachingEvent): boolean {
    const last = lastPlayed.get(event) ?? 0
    return performance.now() - last >= THRESHOLDS.COOLDOWN_MS
  }

  function speak(event: CoachingEvent, priority = false) {
    if (!canPlay(event) && !priority) return
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    lastPlayed.set(event, performance.now())
    const utterance = new SpeechSynthesisUtterance(COACHING_SPEECH[event])
    utterance.lang = 'zh-TW'
    utterance.rate = 0.88
    utterance.pitch = 1.05

    if (priority) window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  function evaluate(ctx: CoachingContext): CoachingEvent | null {
    if (ctx.trackingQuality === 'lost') {
      speak('realign', true)
      return 'realign'
    }

    if (ctx.reps > lastRepSpoken && ctx.motionState === 'sitting') {
      lastRepSpoken = ctx.reps
      speak('rep_done')
      return 'rep_done'
    }

    const tilt = ctx.shoulderTiltDeg ?? 0
    const absTilt = Math.abs(tilt)
    if (absTilt >= THRESHOLDS.TILT_SEVERE_DEG) {
      speak('tilt_severe', true)
      return 'tilt_severe'
    }

    if (ctx.lateralSwayMs2 >= THRESHOLDS.SWAY_MS2) {
      speak('sway_detected')
      return 'sway_detected'
    }

    if (ctx.lastRepSec > 0 && ctx.lastRepSec < THRESHOLDS.TOO_FAST_SEC) {
      speak('too_fast')
      return 'too_fast'
    }

    if (absTilt >= THRESHOLDS.TILT_MILD_DEG) {
      const event = tilt > 0 ? 'tilt_left' : 'tilt_right'
      speak(event)
      return event
    }

    return null
  }

  function reset() {
    lastPlayed.clear()
    lastRepSpoken = 0
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  return { evaluate, reset }
}
