/**
 * lib/synthetic-validation.ts
 *
 * Monte Carlo 文獻對齊驗證引擎
 * Literature Alignment Validation via Monte Carlo Simulation
 *
 * ─── 正確的方法學定義 ──────────────────────────────────────────────────────
 *
 * 本驗證是「文獻對齊驗證（Literature Alignment Validation）」，
 * 不是 FDA 指南中定義的 In Silico Validation。
 *
 * FDA In Silico Validation 指的是：
 *   - CFD（計算流體力學）模擬血流與藥物擴散
 *   - FEA（有限元素分析）模擬骨骼應力
 *   - 基於真實生理參數的虛擬病人數位分身
 *
 * 本驗證的實際意義與限制：
 *   [優點] 確認演算法決策邏輯在數學上與已發表文獻一致
 *   [優點] 確認系統在不同年齡分佈下維持參數邏輯一致性
 *   [限制] Ground Truth 閾值與決策引擎閾值來自相同文獻來源，
 *           存在「同義反覆（Circular）」的驗證侷限性
 *   [限制] 合成數據無法完全模擬真實長者的複雜生理變異
 *   [限制] 尚未與物理治療師的專家判斷進行一致性比對
 *
 * 下一步（計劃中）：
 *   與物理治療師合作執行 n≥30 的專家一致性研究，
 *   計算 ICC（組內相關係數）與 Cohen's Kappa，
 *   目標達到 ICC ≥ 0.75（acceptable reliability）。
 *
 * 數據來源：
 * [1] Bohannon R.W. (2006). J Strength Cond Res, 20(4), 887–889.
 * [2] Whitney S.L. et al. (2005). Physical Therapy, 85(10), 1034–1045.
 * [3] Meretta, B.M. et al. (2006). J Geriatr Phys Ther, 29(1), 3–8.
 */

import { evaluateSession } from '@/lib/decision-engine'
import type { ObservationLevel } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// Bohannon (2006) FTSST 常態分佈參數
// 5 次坐站測試的總時間（秒），依年齡分組
// ─────────────────────────────────────────────────────────────────────────────
export const FTSST_NORMATIVE = {
  '60-69': { meanSec: 11.4, sdSec: 2.6 },
  '70-79': { meanSec: 12.6, sdSec: 3.4 },
  '80-89': { meanSec: 14.8, sdSec: 4.8 },
} as const

export type AgeGroup = keyof typeof FTSST_NORMATIVE

// ─────────────────────────────────────────────────────────────────────────────
// Ground Truth 臨床閾值
// 來源：Bohannon (2006), Whitney (2005)
// ─────────────────────────────────────────────────────────────────────────────
const GT = {
  // >16.7s = >2 SD above 60-69yo mean → clearly slow functional performance
  UNSTABLE_TOTAL_SEC: 16.7,
  // >12s = 比 60-69yo 平均差 → 留意 → caution
  CAUTION_TOTAL_SEC: 12.0,
  // 偏斜角度（居家攝影機版本，對應 MOTION_THRESHOLDS）
  TILT_CAUTION: 20,
  TILT_UNSTABLE: 35,
  // 晃動事件（需要多次或雙模態確認才升級）
  SWAY_CAUTION: 2,
  SWAY_UNSTABLE: 5,
}

export interface SyntheticPatient {
  id: number
  ageGroup: AgeGroup
  totalDurationSec: number
  avgDurationSec: number
  tiltMaxDeg: number
  instabilityEvents: number
  groundTruth: ObservationLevel
  predicted: ObservationLevel
}

export interface ClassMetrics {
  precision: number
  recall: number
  f1: number
  support: number
}

export interface ValidationMetrics {
  n: number
  accuracy: number
  cohensKappa: number
  kappaInterpretation: string
  macroF1: number
  perClass: Record<ObservationLevel, ClassMetrics>
  /** 3×3 混淆矩陣，索引順序：[true_idx][pred_idx]，順序：smooth/attention/review */
  confusionMatrix: number[][]
  /** 每個年齡組的準確率 */
  byAgeGroup: Record<AgeGroup, { n: number; accuracy: number }>
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具函數
// ─────────────────────────────────────────────────────────────────────────────

/** Box-Muller transform：從標準常態分佈取樣 */
function gaussianRandom(mean: number, sd: number): number {
  let u1: number
  do { u1 = Math.random() } while (u1 < 1e-10)
  const u2 = Math.random()
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function interpretKappa(k: number): string {
  if (k >= 0.81) return '幾乎完全一致（Almost Perfect）'
  if (k >= 0.61) return '實質一致（Substantial）'
  if (k >= 0.41) return '中度一致（Moderate）'
  if (k >= 0.21) return '尚可一致（Fair）'
  return '輕微一致（Slight）'
}

// ─────────────────────────────────────────────────────────────────────────────
// 合成患者生成
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 生成單一合成患者
 *
 * 合成策略（有文獻依據）：
 * - FTSST 時間從 Bohannon (2006) 的常態分佈取樣
 * - 偏斜角度與 FTSST 時間正相關（身體功能越差，姿勢控制越弱）
 *   相關性參考：Lusardi et al. (2003) 功能性表現相關研究
 * - 晃動事件用 Poisson-like 分佈（rare event modeling）
 */
export function generateSyntheticPatient(id: number, ageGroup: AgeGroup): SyntheticPatient {
  const norm = FTSST_NORMATIVE[ageGroup]

  // 生成 5 次坐站總時間，物理限制在 [5s, 80s]
  const totalDurationSec = clamp(gaussianRandom(norm.meanSec, norm.sdSec), 5, 80)
  const avgDurationSec = totalDurationSec / 5

  // z-score：表現相對於本年齡組規範的偏離量（正 = 比平均差）
  const zScore = (totalDurationSec - norm.meanSec) / norm.sdSec

  // 偏斜：基礎 5°，隨表現惡化而增加，加個體隨機變異（SD ≈ 4°）
  const tiltMaxDeg = clamp(Math.abs(gaussianRandom(5 + zScore * 3.2, 4)), 0, 45)

  // 晃動：Poisson mean 隨 z-score 增加，至少 0
  const swayMean = clamp(0.25 + zScore * 0.45, 0, 4)
  const instabilityEvents = clamp(
    Math.round(gaussianRandom(swayMean, 0.85)), 0, 5,
  )

  // ── Ground Truth 標記（已發表臨床閾值）──────────────────────
  // 注意：Ground Truth 與決策引擎使用相同的文獻閾值來源，
  // 這是本驗證方法的已知侷限性（Parameter Consistency Test）。
  let groundTruth: ObservationLevel
  if (
    totalDurationSec >= GT.UNSTABLE_TOTAL_SEC ||
    instabilityEvents >= GT.SWAY_UNSTABLE ||
    tiltMaxDeg >= GT.TILT_UNSTABLE
  ) {
    groundTruth = 'review'
  } else if (
    totalDurationSec >= GT.CAUTION_TOTAL_SEC ||
    instabilityEvents >= GT.SWAY_CAUTION ||
    tiltMaxDeg >= GT.TILT_CAUTION
  ) {
    groundTruth = 'attention'
  } else {
    groundTruth = 'smooth'
  }

  // ── CareLoop 系統預測──────────────────────────────────────
  const { level: predicted } = evaluateSession({
    reps: 5,
    totalDurationSec,
    avgDurationSec,
    tiltMaxDeg,
    instabilityEvents,
    trackingQuality: 'good',
  })

  return {
    id, ageGroup,
    totalDurationSec, avgDurationSec,
    tiltMaxDeg, instabilityEvents,
    groundTruth, predicted,
  }
}

const RISK_ORDER: ObservationLevel[] = ['smooth', 'attention', 'review']

// ─────────────────────────────────────────────────────────────────────────────
// Monte Carlo 主程序
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 執行 Monte Carlo 合成患者隊列驗證
 *
 * @param n - 合成患者數量（建議 ≥ 500，評審示範用 1000）
 * @param ageDistribution - 年齡群比例（預設模擬台灣社區長輩人口結構）
 *
 * 台灣 65+ 人口年齡結構（2023 衛福部統計）：
 *   60-69: ~45%, 70-79: ~40%, 80+: ~15%
 */
export function runMonteCarloValidation(
  n: number,
  ageDistribution: Record<AgeGroup, number> = {
    '60-69': 0.45,
    '70-79': 0.40,
    '80-89': 0.15,
  },
): { patients: SyntheticPatient[]; metrics: ValidationMetrics } {
  const patients: SyntheticPatient[] = []
  const ageGroups = Object.keys(ageDistribution) as AgeGroup[]

  for (let i = 0; i < n; i++) {
    let r = Math.random()
    let ageGroup: AgeGroup = '60-69'
    for (const ag of ageGroups) {
      r -= ageDistribution[ag]
      if (r <= 0) { ageGroup = ag; break }
    }
    patients.push(generateSyntheticPatient(i, ageGroup))
  }

  // ── 混淆矩陣 ──────────────────────────────────────────────
  const cm: number[][] = [[0,0,0],[0,0,0],[0,0,0]]
  const ageCounts: Record<AgeGroup, { total: number; correct: number }> = {
    '60-69': { total: 0, correct: 0 },
    '70-79': { total: 0, correct: 0 },
    '80-89': { total: 0, correct: 0 },
  }

  for (const p of patients) {
    const ti = RISK_ORDER.indexOf(p.groundTruth)
    const pi = RISK_ORDER.indexOf(p.predicted)
    cm[ti][pi]++
    ageCounts[p.ageGroup].total++
    if (ti === pi) ageCounts[p.ageGroup].correct++
  }

  const correct = cm[0][0] + cm[1][1] + cm[2][2]
  const accuracy = correct / n

  // ── Cohen's Kappa ──────────────────────────────────────────
  const pExpected = RISK_ORDER.reduce((sum, _, i) => {
    const rowSum = cm[i].reduce((a, b) => a + b, 0)
    const colSum = cm.reduce((s, row) => s + row[i], 0)
    return sum + (rowSum / n) * (colSum / n)
  }, 0)
  const cohensKappa = (accuracy - pExpected) / (1 - pExpected + 1e-10)

  // ── Per-class Precision / Recall / F1 ─────────────────────
  const perClass = {} as ValidationMetrics['perClass']
  for (let i = 0; i < 3; i++) {
    const label = RISK_ORDER[i]
    const tp = cm[i][i]
    const fp = cm.reduce((s, row, ri) => ri !== i ? s + row[i] : s, 0)
    const fn = cm[i].reduce((s, v, ci) => ci !== i ? s + v : s, 0)
    const support = cm[i].reduce((a, b) => a + b, 0)
    const precision = tp / (tp + fp + 1e-10)
    const recall    = tp / (tp + fn + 1e-10)
    const f1 = (2 * precision * recall) / (precision + recall + 1e-10)
    perClass[label] = { precision, recall, f1, support }
  }
  const macroF1 = (perClass.smooth.f1 + perClass.attention.f1 + perClass.review.f1) / 3

  const byAgeGroup = Object.fromEntries(
    ageGroups.map(ag => [ag, {
      n: ageCounts[ag].total,
      accuracy: ageCounts[ag].total > 0
        ? ageCounts[ag].correct / ageCounts[ag].total
        : 0,
    }]),
  ) as Record<AgeGroup, { n: number; accuracy: number }>

  return {
    patients,
    metrics: {
      n, accuracy, cohensKappa,
      kappaInterpretation: interpretKappa(cohensKappa),
      macroF1, perClass,
      confusionMatrix: cm,
      byAgeGroup,
    },
  }
}
