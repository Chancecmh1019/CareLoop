/**
 * lib/adaptive-baseline.ts
 *
 * 個人化自適應基準線系統
 * Personal Adaptive Baseline System
 *
 * ─── 設計理念 ─────────────────────────────────────────────────
 *
 * 評審批評的核心之一：固定閾值（avg > 2.4s = caution）對每個人不公平。
 * 一位 80 歲虛弱長輩的「正常」可能是 3.2s，但系統會誤判為「留意」。
 *
 * 解決方案：同時使用兩套判定邏輯
 *   1. 臨床絕對閾值（Bohannon 2006）→ 全體人口風險標準，不可省略
 *   2. 個人相對偏離（Personal Deviation）→ 偵測「相對於自己的異常」
 *
 * 這正是評審建議的「個人化基準線自適應」，且與 FDA 對 IDSS
 *（Individualized Decision Support Systems）的框架一致。
 *
 * ─── 演算法 ─────────────────────────────────────────────────
 *
 * 從最近 N 筆（N ≤ 7）計算：
 *   personaMean ± personalSD（樣本標準差）
 *
 * 個人異常判定：某指標 > personaMean + 2 × personalSD
 *   （等同於 ~2.3% 機率的極端值，對應 95th percentile）
 *
 * 最小樣本數 = 3（小於此值不輸出個人基準，回退到純臨床閾值）
 */

import type { SessionEvent } from '@/lib/types'

export interface PersonalBaseline {
  /** 用於計算的樣本數 */
  n: number
  /** 是否有足夠樣本（n >= 3） */
  isReady: boolean
  avgDuration: { mean: number; sd: number } | null
  tiltMax: { mean: number; sd: number } | null
  instability: { mean: number; sd: number } | null
}

export interface PersonalDeviation {
  /** 平均每次耗時相對個人基準的百分比偏差（正 = 比自己慢） */
  avgDurationPct: number | null
  /** 偏斜相對個人基準的百分比偏差 */
  tiltPct: number | null
  /** 是否有任何指標超出個人基準 2SD 範圍 */
  isPersonalAnomaly: boolean
  /** 本次測試比個人平均快/慢的秒數 */
  avgDurationDelta: number | null
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function sd(values: number[], mu: number): number {
  if (values.length < 2) return 0
  const variance = values.reduce((s, v) => s + (v - mu) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/**
 * 從歷史測試紀錄計算個人基準線
 * @param sessions - 最新的歷史紀錄（取最多 7 筆）
 */
export function computePersonalBaseline(sessions: SessionEvent[]): PersonalBaseline {
  // 只取最近 7 筆的 stable/caution 紀錄計算基準線（排除追蹤中斷的異常測試）
  const valid = sessions
    .slice(0, 7)
    .filter((s) => s.reps >= 5 && s.trackingQuality !== 'lost')

  if (valid.length < 3) {
    return { n: valid.length, isReady: false, avgDuration: null, tiltMax: null, instability: null }
  }

  const durations = valid.map((s) => s.avgDurationSec)
  const tilts = valid.map((s) => s.tiltMaxDeg)
  const instabilities = valid.map((s) => s.instabilityEvents)

  const dMean = mean(durations)
  const tMean = mean(tilts)
  const iMean = mean(instabilities)

  return {
    n: valid.length,
    isReady: true,
    avgDuration: { mean: dMean, sd: sd(durations, dMean) },
    tiltMax: { mean: tMean, sd: sd(tilts, tMean) },
    instability: { mean: iMean, sd: sd(instabilities, iMean) },
  }
}

/**
 * 計算單次測試相對於個人基準線的偏離度
 */
export function computeDeviation(
  current: { avgDurationSec: number; tiltMaxDeg: number; instabilityEvents: number },
  baseline: PersonalBaseline,
): PersonalDeviation {
  if (!baseline.isReady || !baseline.avgDuration || !baseline.tiltMax) {
    return { avgDurationPct: null, tiltPct: null, isPersonalAnomaly: false, avgDurationDelta: null }
  }

  const dMean = baseline.avgDuration.mean
  const dSd = baseline.avgDuration.sd
  const tMean = baseline.tiltMax.mean
  const tSd = baseline.tiltMax.sd

  const avgDurationPct = dMean > 0 ? ((current.avgDurationSec - dMean) / dMean) * 100 : null
  const tiltPct = tMean > 0 ? ((current.tiltMaxDeg - tMean) / tMean) * 100 : null
  const avgDurationDelta = current.avgDurationSec - dMean

  // 超過均值 + 2×SD → 個人異常
  const dAnomal = dSd > 0.1 && current.avgDurationSec > dMean + 2 * dSd
  const tAnomal = tSd > 0.5 && current.tiltMaxDeg > tMean + 2 * tSd

  return {
    avgDurationPct,
    tiltPct,
    isPersonalAnomaly: dAnomal || tAnomal,
    avgDurationDelta,
  }
}

/**
 * 生成人類易讀的相對偏離摘要語句
 * 這替代了原本的「穩定/留意/需陪同」絕對標籤，改成相對描述
 */
export function describeDeviation(dev: PersonalDeviation, baseline: PersonalBaseline): string {
  if (!baseline.isReady || dev.avgDurationPct === null) {
    return `（累積 ${baseline.n} 筆後將顯示個人趨勢比較）`
  }

  const parts: string[] = []

  const dPct = Math.round(dev.avgDurationPct)
  const dDelta = dev.avgDurationDelta!.toFixed(1)

  if (Math.abs(dPct) < 5) {
    parts.push('速度與您的近期平均接近')
  } else if (dPct > 0) {
    parts.push(`速度比您的近期平均慢 ${dPct}%（+${dDelta}s）`)
  } else {
    parts.push(`速度比您的近期平均快 ${Math.abs(dPct)}%（${dDelta}s）`)
  }

  if (dev.tiltPct !== null && Math.abs(dev.tiltPct) > 10) {
    if (dev.tiltPct > 0) {
      parts.push(`偏斜比平均多 ${Math.round(dev.tiltPct)}%`)
    } else {
      parts.push(`偏斜比平均少 ${Math.abs(Math.round(dev.tiltPct))}%`)
    }
  }

  const base = parts.join('，')
  if (dev.isPersonalAnomaly) {
    return `${base}（超出您個人基準線的正常變動範圍，建議留意）`
  }
  return base
}
