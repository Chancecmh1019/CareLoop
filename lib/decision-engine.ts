import type { ObservationLevel, SessionEvent, TrackingQuality } from '@/lib/types'

/**
 * MOTION_THRESHOLDS — 與已發表臨床文獻對齊的觀察閾值
 *
 * 時間閾值依據：
 *   Bohannon (2006). J Strength Cond Res 20(4):887
 *   - 60-69 歲規範值：11.4s（5次總計）= 2.28s/次
 *   - >12s（2.4s/次）= 比 60-69 歲平均偏慢 → attention
 *   - >16.7s（3.34s/次）= 文獻定義高偏移範圍 → review
 *
 * 偏斜閾值說明（居家攝影機版本）：
 *   臨床 FTSST 對側向偏斜無標準化角度閾值（Bohannon 2006；MedBridge 2025）。
 *   偏斜程度以「定性觀察」為主，非精確角度。
 *   本系統使用攝影機姿態估算，MediaPipe 本身有 ±5–8° 的估算誤差，
 *   加上相機角度偏差與自然體態不對稱，設定過嚴的閾值會造成大量誤判。
 *
 *   依居家攝影機工具的合理容錯範圍設定：
 *   - attention ≥ 20°：超過正常估算誤差範圍，值得留意
 *   - review   ≥ 35°：明顯偏移，建議家人觀察
 *
 * 法律聲明：本系統輸出為動作觀察描述，不構成醫療診斷或健康建議。
 */
export const MOTION_THRESHOLDS = {
  TARGET_REPS: 5,
  MIN_STATE_HOLD_MS: 300,
  /** 站立後等待多久才播「請坐下」語音提示（ms）— 給長輩完整站直的時間 */
  STAND_PAUSE_MS: 1800,
  /** 坐下確認後等待多久才播「請起立」語音提示（ms）— 給長輩喘息的時間 */
  SIT_PAUSE_MS: 1200,
  STAND_DELTA_Y: 0.1,
  SITTING_TOLERANCE_Y: 0.075,
  LEG_EXTENSION_DELTA_Y: 0.08,
  LEG_EXTENSION_SITTING_TOLERANCE_Y: 0.045,
  MIN_VISIBILITY_AVG: 0.55,
  /** 居家攝影機容錯：MediaPipe 估算誤差 ±5-8°，加上體態自然不對稱，20° 以下視為正常範圍 */
  MAX_TILT_DEG_ATTENTION: 20,
  /** 35° 以上才視為明顯偏移，建議家人確認 */
  MAX_TILT_DEG_REVIEW: 35,
  /** 側向晃動判定：需 ≥5 次才升級，避免正常起立動作誤觸 */
  INSTABILITY_X_JUMP: 0.15,
  FAST_REP_SEC: 1.2,
  /**
   * SLOW_AVG_SEC = 2.4s/次（5次總計 12s）
   * 對應 Bohannon (2006) 60-69 歲規範值的「偏慢」截斷點
   */
  SLOW_AVG_SEC: 2.4,
  /**
   * VERY_SLOW_AVG_SEC = 3.34s/次（5次總計 16.7s）
   * 對應文獻定義「顯著偏慢」截斷點（>2 SD above 60-69yo mean）
   */
  VERY_SLOW_AVG_SEC: 3.34,
  /**
   * SEATED_CANDIDATE_FRAMES: 座下確認所需的持續帧數
   * 因正面拍攝時骨盆前後移動在 2D Y軸變化小，需較寬沬的確認磁窗（降自 6 幀 4）
   */
  SEATED_CANDIDATE_FRAMES: 4,
  // 向下相容舊名稱（deprecated）
  get MAX_TILT_DEG_STABLE() { return this.MAX_TILT_DEG_ATTENTION },
  get MAX_TILT_DEG_UNSTABLE() { return this.MAX_TILT_DEG_REVIEW },
}

export interface DecisionInput {
  reps: number
  totalDurationSec: number
  avgDurationSec: number
  tiltMaxDeg: number
  instabilityEvents: number
  trackingQuality: TrackingQuality
  /**
   * 雙模態融合後的晃動置信度（0-1）
   * 視覺偵測到位移 + 慣性感測器確認側向加速度時升高
   * 預設 0（未融合或感測器不可用時）
   */
  swayConfidence?: number
}

export function evaluateSession(input: DecisionInput): Pick<SessionEvent, 'level' | 'notes'> {
  const notes: string[] = []
  let level: ObservationLevel = 'smooth'

  if (input.reps < MOTION_THRESHOLDS.TARGET_REPS) {
    level = 'review'
    notes.push('本次偵測到的坐站次數未達 5 次，資料可能不完整，建議重新進行觀察。')
  }

  if (input.trackingQuality === 'lost') {
    level = 'review'
    notes.push('觀察過程中姿態偵測訊號中斷，本筆資料可能不完整，建議重新操作。')
  }

  if (input.tiltMaxDeg >= MOTION_THRESHOLDS.MAX_TILT_DEG_REVIEW) {
    level = 'review'
    notes.push('偵測到明顯肩膀偏移，建議家人觀察起身與坐下時是否有左右不對稱的現象。')
  } else if (input.tiltMaxDeg >= MOTION_THRESHOLDS.MAX_TILT_DEG_ATTENTION && level !== 'review') {
    level = 'attention'
    notes.push('偵測到輕度肩膀偏移，建議家人留意後續測試是否持續出現。')
  }

  // 慣性感測器確認：若雙模態融合 swayConfidence >= 0.7，強化晃動判定
  // 這是 fuseModalities() 結果真正接入決策路徑的地方
  const swayConfirmed = (input.swayConfidence ?? 0) >= 0.7

  // 晃動判定：需要 >=5 次才觸發 review，避免正常起立動作就被誤判
  if (input.instabilityEvents >= 5 || swayConfirmed) {
    level = 'review'
    const reason = swayConfirmed && input.instabilityEvents < 5
      ? '雙模態感測器確認明顯側向晃動（視覺 + 慣性一致），建議家人確認操作環境是否安全。'
      : '偵測到多次明顯晃動訊號，建議家人確認操作環境是否安全，必要時陪同操作。'
    notes.push(reason)
  } else if (input.instabilityEvents >= 2 && level === 'smooth') {
    level = 'attention'
    notes.push('偵測到少數晃動訊號，建議持續觀察後續測試是否重複出現。')
  }

  // 時間觀察：依 Bohannon (2006) 臨床規範值
  if (input.avgDurationSec > MOTION_THRESHOLDS.VERY_SLOW_AVG_SEC && level !== 'review') {
    level = 'review'
    notes.push('完成速度明顯低於文獻 60-69 歲族群參考範圍（>16.7 秒），建議家人留意並持續追蹤趨勢。')
  } else if (input.avgDurationSec > MOTION_THRESHOLDS.SLOW_AVG_SEC && level === 'smooth') {
    level = 'attention'
    notes.push('完成速度略低於 60-69 歲族群參考均值（12 秒），建議持續記錄趨勢。')
  }

  if (notes.length === 0) {
    notes.push('本次 5 次坐站偵測結果未見明顯偏移或晃動訊號。')
  }

  notes.push('CareLoop 僅提供居家動作觀察記錄，不取代物理治療師或醫師的專業評估。')

  return { level, notes }
}

/**
 * 將 ObservationLevel 轉換為使用者介面顯示文字
 * 刻意使用描述性語言，避免醫療診斷暗示
 */
export function levelLabel(level: ObservationLevel | null) {
  if (level === 'smooth')    return '動作順暢'
  if (level === 'attention') return '略有偏移'
  if (level === 'review')    return '建議家人確認'
  return '尚無資料'
}
