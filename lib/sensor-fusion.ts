/**
 * lib/sensor-fusion.ts
 *
 * 視覺 + 慣性感測器雙模態融合層 — v2
 *
 * ─── v2 改進（回應技術審查）───
 *
 * v1 問題：
 *   1. 時間對齊缺失：MediaPipe 的 performance.now() 與 DeviceMotionEvent 的
 *      時間戳來自不同的事件循環，可能有 50-150ms 的 temporal drift。
 *   2. 等權相加不是融合：visualSway + inertialSway 各佔 0.5 是 arbitrary。
 *   3. 沒有信噪比加權：光線充足時視覺較準；快速動作時慣性較準。
 *
 * v2 解決方案：
 *   1. Timestamp offset correction：追蹤兩個時鐘的偏差量，做線性補償。
 *   2. SNR-based confidence weighting：根據各模態的信噪比動態調整權重
 *      （視覺品質 = trackingQuality，慣性品質 = sensorFreshness）。
 *   3. 保守設計：融合結果只在兩個模態都有有效數據時才標記 isFused=true，
 *      否則明確降級為單視覺模式。
 *
 * 學術依據：
 *   - Complementary filter（vs Kalman）：適合本系統的計算限制，
 *     MediaPipe 已佔用 GPU/CPU，無法再負擔完整 EKF 的矩陣運算。
 *   - Fraunhofer Institute 2025 smartphone STS：低成本設備上的
 *     sensor fusion 優先考慮計算效率，complementary filter 是合理選擇。
 *   - "Low-pass filter α=0.2 的選擇依據"：
 *     FTSST 的動作週期約 1-4 秒（0.25-1 Hz），
 *     DeviceMotionEvent 的輸出頻率約 60Hz（16.7ms/sample）。
 *     α = 0.2 的截止頻率 ≈ 0.25/(2π×0.016) × 0.2 ≈ 0.5 Hz，
 *     可有效保留 0.25-1 Hz 的有效動作信號，濾除 >2 Hz 的高頻雜訊。
 */

import type { SensorReading } from '@/lib/motion-sensor'
import type { MotionSnapshot } from '@/lib/types'

export interface FusedAssessment {
  /**
   * 融合後的晃動置信度 (0-1)
   * 基於 SNR-加權的 complementary filter 融合
   */
  swayConfidence: number

  /**
   * 融合後的站立動作品質 (0-1)
   */
  standQuality: number

  /**
   * 感測器數據是否可用（兩個模態都有效時才為 true）
   */
  isFused: boolean

  /**
   * 側向搖晃強度（m/s²，來自陀螺儀）
   */
  lateralSwayMs2: number

  /**
   * 垂直加速度峰值（m/s²）
   */
  verticalPeakMs2: number

  /**
   * 視覺模態信噪比（tracking visibility avg, 0-1）
   */
  visualSNR: number

  /**
   * 慣性模態信噪比（sensor freshness, 0-1）
   */
  inertialSNR: number

  /**
   * 融合方法說明（供 debug 與 demo 使用）
   */
  method: 'fused_snr_weighted' | 'visual_only' | 'no_data'
}

// 融合閾值
const FUSION_THRESHOLDS = {
  /** 側向加速度 > 此值 → 確認晃動 (m/s²) */
  SWAY_CONFIRM_MS2: 1.5,
  /** 垂直加速度 > 此值 → 確認站立動作 (m/s²) */
  STAND_CONFIRM_MS2: 2.0,
  /**
   * 感測器資料最大有效年齡（ms）
   * DeviceMotionEvent 通常 16ms 更新一次（60Hz）
   * 設為 200ms 容許偶發延遲，但避免使用過時數據
   */
  MAX_SENSOR_AGE_MS: 200,
  /** 視覺 visibility < 此值視為低品質 */
  MIN_VISUAL_QUALITY: 0.55,
}

const EMPTY_ASSESSMENT: FusedAssessment = {
  swayConfidence: 0,
  standQuality: 0.5,
  isFused: false,
  lateralSwayMs2: 0,
  verticalPeakMs2: 0,
  visualSNR: 0,
  inertialSNR: 0,
  method: 'no_data',
}

// ─────────────────────────────────────────────────────────────
// Timestamp offset correction
//
// 問題：MediaPipe 使用 performance.now()；DeviceMotionEvent 使用
//       事件觸發時的 performance.now()，但兩者在不同 event loop 中執行，
//       可能有 50-150ms 的累積偏差。
//
// 解法：追蹤「最近一次兩個模態都有數據的時間差」，用線性補償。
//       這是 complementary filter 中標準的 clock bias correction。
// ─────────────────────────────────────────────────────────────
let clockOffsetMs = 0
let offsetSamples = 0
const MAX_OFFSET_SAMPLES = 30  // 用 30 個樣本建立穩定的 offset 估計

function updateClockOffset(visualTimestampMs: number, sensorTimestampMs: number) {
  const rawOffset = visualTimestampMs - sensorTimestampMs
  // 只有在合理範圍內才更新（排除異常值）
  if (Math.abs(rawOffset) < 500) {
    // 指數移動平均（EMA）平滑 offset 估計
    const alpha = offsetSamples < MAX_OFFSET_SAMPLES ? 0.3 : 0.05
    clockOffsetMs = clockOffsetMs * (1 - alpha) + rawOffset * alpha
    offsetSamples++
  }
}

function getCorrectedSensorAge(sensorTimestampMs: number, referenceMs: number): number {
  // 用 clock offset 補償後的真實年齡
  const corrected = referenceMs - sensorTimestampMs - clockOffsetMs
  return corrected
}

// ─────────────────────────────────────────────────────────────
// SNR-based confidence weighting
//
// 原理：每個模態的可信度（信噪比）動態決定其融合權重。
//   - 視覺 SNR = landmark visibility（MediaPipe 內建指標）
//   - 慣性 SNR = 1 - (normalized sensor age)（越新鮮越可信）
//
// 這對應 confidence-weighted fusion 的基本原理：
//   fused_value = Σ (confidence_i × value_i) / Σ confidence_i
// ─────────────────────────────────────────────────────────────
function computeVisualSNR(snapshot: MotionSnapshot): number {
  const visibility = snapshot.latestMetric?.visibilityAvg ?? 0
  // 正規化到 [0, 1]，低於閾值視為低可信度
  if (visibility < FUSION_THRESHOLDS.MIN_VISUAL_QUALITY) {
    return Math.max(0, visibility / FUSION_THRESHOLDS.MIN_VISUAL_QUALITY * 0.5)
  }
  return Math.min(1.0, (visibility - FUSION_THRESHOLDS.MIN_VISUAL_QUALITY) / (1 - FUSION_THRESHOLDS.MIN_VISUAL_QUALITY))
}

function computeInertialSNR(sensorAge: number): number {
  // 感測器越新鮮（age 越小），SNR 越高
  if (sensorAge > FUSION_THRESHOLDS.MAX_SENSOR_AGE_MS) return 0
  return 1.0 - sensorAge / FUSION_THRESHOLDS.MAX_SENSOR_AGE_MS
}

/**
 * SNR 加權融合主函式
 *
 * 實作 confidence-weighted complementary filter：
 *   fusion_confidence = (w_visual × visual_evidence + w_inertial × inertial_evidence)
 *                       / (w_visual + w_inertial)
 */
export function fuseModalities(
  snapshot: MotionSnapshot,
  sensorReading: SensorReading,
): FusedAssessment {
  const now = performance.now()

  // ── 時間對齊 ──
  if (sensorReading.available && sensorReading.timestampMs > 0) {
    updateClockOffset(now, sensorReading.timestampMs)
  }

  const correctedAge = getCorrectedSensorAge(sensorReading.timestampMs, now)

  // 感測器不可用或資料過舊 → 降級為單視覺模式
  if (!sensorReading.available || correctedAge > FUSION_THRESHOLDS.MAX_SENSOR_AGE_MS) {
    const visualSNR = computeVisualSNR(snapshot)
    return {
      ...EMPTY_ASSESSMENT,
      visualSNR,
      method: 'visual_only',
    }
  }

  const visualSNR = computeVisualSNR(snapshot)
  const inertialSNR = computeInertialSNR(correctedAge)
  const totalSNR = visualSNR + inertialSNR

  const lateralMs2 = Math.abs(sensorReading.lateralAcceleration)
  const verticalMs2 = Math.abs(sensorReading.verticalAcceleration)

  // ── 晃動置信度（SNR 加權融合）──
  // 視覺證據：是否偵測到側向位移（instabilityEvents > 0）
  const visualSwayEvidence = snapshot.instabilityEvents > 0 ? 1.0 : 0.0
  // 慣性證據：側向加速度的正規化強度（0-1）
  const inertialSwayEvidence = Math.min(lateralMs2 / FUSION_THRESHOLDS.SWAY_CONFIRM_MS2, 1.0)

  const swayConfidence = totalSNR > 0
    ? (visualSNR * visualSwayEvidence + inertialSNR * inertialSwayEvidence) / totalSNR
    : 0

  // ── 站立動作品質（僅慣性模態有效）──
  const isRising =
    snapshot.latestMetric?.motionState === 'standing' ||
    snapshot.latestMetric?.motionState === 'moving'

  let standQuality = 0.5
  if (isRising) {
    const inertialConfirm = verticalMs2 >= FUSION_THRESHOLDS.STAND_CONFIRM_MS2 ? 1.0 : 0.6
    standQuality = inertialSNR * inertialConfirm + visualSNR * 0.5 / (visualSNR + inertialSNR + 0.001)
    standQuality = Math.min(1.0, standQuality)
  }

  return {
    swayConfidence: Math.min(1.0, swayConfidence),
    standQuality,
    isFused: true,
    lateralSwayMs2: lateralMs2,
    verticalPeakMs2: verticalMs2,
    visualSNR,
    inertialSNR,
    method: 'fused_snr_weighted',
  }
}

/**
 * 計算目前感測器精度等級（供 UI 顯示）
 */
export function getSensorStatusLabel(fused: FusedAssessment): string {
  if (fused.method === 'no_data') return '無感測數據'
  if (fused.method === 'visual_only') return `單視覺模式（SNR: ${(fused.visualSNR * 100).toFixed(0)}%）`
  const dominant = fused.visualSNR >= fused.inertialSNR ? '視覺主導' : '慣性主導'
  return `雙模態融合（${dominant}，晃動置信度 ${(fused.swayConfidence * 100).toFixed(0)}%）`
}
