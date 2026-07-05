/**
 * ObservationLevel — 動作觀察等級
 *
 * 命名設計原則（法律與醫療合規）：
 *   刻意避免 "stable / unstable / risk" 等功能性評估用語。
 *   系統只陳述「偵測到的現象」，不做醫療診斷，不給健康建議。
 *
 *   smooth    → 偵測到的動作流暢，無明顯偏移訊號
 *   attention → 偵測到輕度偏移，建議家人留意
 *   review    → 偵測到明顯偏移或晃動，建議家人確認是否需要協助
 */
export type ObservationLevel = 'smooth' | 'attention' | 'review'

/**
 * @deprecated 請改用 ObservationLevel
 * 保留此別名以便舊程式碼漸進遷移，未來版本將移除。
 */
export type RiskLevel = ObservationLevel

export type MotionState = 'sitting' | 'standing' | 'moving' | 'unknown'
export type CoachAction = 'hold' | 'stand' | 'sit' | 'complete'
export type TrackingQuality = 'good' | 'poor' | 'lost'

/**
 * 雙模態感測器融合評估結果
 * 視覺（MediaPipe）+ 慣性（DeviceMotionEvent）聯合輸出
 */
export interface FusedMetric {
  swayConfidence: number
  standQuality: number
  isFused: boolean
  lateralSwayMs2: number
  verticalPeakMs2: number
  visualSNR: number
  inertialSNR: number
  method: 'fused_snr_weighted' | 'visual_only' | 'no_data'
}

/**
 * NarrativeAdapter 抽象介面
 * 規則式引擎（RuleBased）與 LLM（WebLLM/OpenAI）的共同介面
 * 未來接入本地 LLM 只需實作此介面，呼叫端無需修改
 */
export interface NarrativeAdapter {
  generateSessionSummary(session: SessionEvent): string | Promise<string>
  generateTrendNarrative(summary: TrendSummary): string | Promise<string>
  answerFamilyQuestion(question: string, sessions: SessionEvent[]): string | Promise<string>
}

export interface FrameMetric {
  timestampMs: number
  hipY: number | null
  hipX: number | null
  shoulderTiltDeg: number | null
  visibilityAvg: number
  motionState: MotionState
}

export interface SessionEvent {
  id: string
  timestamp: string
  reps: number
  totalDurationSec: number
  avgDurationSec: number
  tiltMaxDeg: number
  instabilityEvents: number
  level: ObservationLevel
  trackingQuality: TrackingQuality
  notes: string[]
}

export interface TrendSummary {
  totalSessions: number
  latestLevel: ObservationLevel | null
  avgDurationSec: number | null
  totalInstabilityEvents: number
  attentionOrReviewCount: number
  narrative: string
}

export interface LandmarkLike {
  x: number
  y: number
  z?: number
  visibility?: number
}

export interface EnvironmentQuality {
  lighting: 'good' | 'poor'
  distance: 'tooClose' | 'tooFar' | 'good'
  angle: 'tooHigh' | 'tooLow' | 'good'
  ready: boolean
  personMissing?: boolean
  bodyIncomplete?: boolean
}

export interface MotionSnapshot {
  reps: number
  nextAction: CoachAction
  totalDurationSec: number
  avgDurationSec: number
  /** Maximum absolute tilt (degrees) seen during the session — used for summary statistics */
  tiltMaxDeg: number
  /**
   * Latest signed trunk lateral deviation (degrees) for this frame.
   * Positive = shoulders shifted right relative to hips (from camera view).
   * Used by PoseCanvas to determine guidance arrow direction.
   */
  tiltSignedDeg: number
  instabilityEvents: number
  trackingQuality: TrackingQuality
  latestMetric: FrameMetric | null
  complete: boolean
}
