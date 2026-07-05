/**
 * lib/narrative-engine.ts
 *
 * 規則式敘事引擎 — 將結構化測試數據轉成家屬看得懂的照護語言
 *
 * 架構說明（透明聲明）：
 *   本引擎為規則式（Rule-Based）系統，不使用 LLM 或機器學習。
 *   這是刻意的設計選擇：
 *     1. 醫療鄰近場景的幻覺風險：LLM 可能生成無依據的照護建議
 *     2. 可解釋性：每段輸出都對應確定的數值閾值，家屬可以追溯
 *     3. 零 API 費用、完全離線、延遲為零
 *   介面設計（NarrativeAdapter）確保未來可無縫升級至 on-device LLM。
 *
 * 問答能力（v2）：
 *   - 時間感知：今天、昨天、上週、本週、上個月、最近 N 筆
 *   - 趨勢分析：有沒有進步、變好了嗎、退步了嗎
 *   - 指標查詢：速度、偏斜、晃動、穩定度
 *   - 個人比較：比上次、和之前比
 *   - 行動建議：需要注意什麼、家人要做什麼
 */
import type { NarrativeAdapter, SessionEvent, TrendSummary } from '@/lib/types'
import { levelLabel } from '@/lib/decision-engine'

export function formatSessionDate(timestamp: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

export function generateSessionSummary(session: SessionEvent): string {
  const base = `${formatSessionDate(session.timestamp)} 完成 ${session.reps}/5 次坐站，總耗時 ${session.totalDurationSec.toFixed(1)} 秒，平均每次 ${session.avgDurationSec.toFixed(1)} 秒。`
  const risk = `系統標記為「${levelLabel(session.level)}」，最大偏斜 ${session.tiltMaxDeg.toFixed(0)} 度，晃動事件 ${session.instabilityEvents} 次。`
  return `${base}${risk}`
}

export function generateTrendSummary(sessions: SessionEvent[]): TrendSummary {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      latestLevel: null,
      avgDurationSec: null,
      totalInstabilityEvents: 0,
      cautionOrUnstableCount: 0,
      narrative: '目前沒有測試紀錄。完成一次坐站測試並儲存後，系統會在這裡整理趨勢。',
    }
  }

  const recent = sessions.slice(0, 7)
  const avgDurationSec =
    recent.reduce((sum, item) => sum + item.avgDurationSec, 0) / recent.length
  const totalInstabilityEvents = recent.reduce((sum, item) => sum + item.instabilityEvents, 0)
  const cautionOrUnstableCount = recent.filter((item) => item.level !== 'smooth').length
  const latestLevel = sessions[0]?.level ?? null

  // 趨勢方向判斷（比較最近 3 筆 vs 前 3 筆）
  let trendNote = ''
  if (sessions.length >= 6) {
    const recentAvg = sessions.slice(0, 3).reduce((s, x) => s + x.avgDurationSec, 0) / 3
    const olderAvg = sessions.slice(3, 6).reduce((s, x) => s + x.avgDurationSec, 0) / 3
    const delta = recentAvg - olderAvg
    if (delta > 0.5) trendNote = '近期速度略有變慢趨勢。'
    else if (delta < -0.5) trendNote = '近期速度有所改善。'
  }

  const narrative =
    cautionOrUnstableCount === 0
      ? `最近 ${recent.length} 筆整體穩定，沒有明顯晃動或偏斜訊號。${trendNote}`
      : `最近 ${recent.length} 筆中有 ${cautionOrUnstableCount} 筆需要留意。${trendNote}建議觀察是否集中在特定日期或疲累時段。`

  return {
    totalSessions: sessions.length,
    latestLevel,
    avgDurationSec,
    totalInstabilityEvents,
    cautionOrUnstableCount,
    narrative,
  }
}

// ─────────────────────────────────────────────────────────────
// 時間工具函數
// ─────────────────────────────────────────────────────────────
function isWithinDays(timestamp: string, days: number): boolean {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return new Date(timestamp).getTime() > cutoff
}

function filterByTimeKeyword(sessions: SessionEvent[], lower: string): SessionEvent[] | null {
  if (lower.includes('今天') || lower.includes('今日')) {
    return sessions.filter((s) => isWithinDays(s.timestamp, 1))
  }
  if (lower.includes('昨天') || lower.includes('昨日')) {
    const now = Date.now()
    return sessions.filter((s) => {
      const t = new Date(s.timestamp).getTime()
      return t > now - 2 * 86400000 && t < now - 86400000
    })
  }
  if (lower.includes('本週') || lower.includes('這週') || lower.includes('這周')) {
    return sessions.filter((s) => isWithinDays(s.timestamp, 7))
  }
  if (lower.includes('上週') || lower.includes('上周') || lower.includes('上個禮拜')) {
    const now = Date.now()
    return sessions.filter((s) => {
      const t = new Date(s.timestamp).getTime()
      return t > now - 14 * 86400000 && t < now - 7 * 86400000
    })
  }
  if (lower.includes('上個月') || lower.includes('上月') || lower.includes('這個月') || lower.includes('本月')) {
    return sessions.filter((s) => isWithinDays(s.timestamp, 30))
  }
  if (lower.includes('最近') || lower.includes('近期') || lower.includes('最新')) {
    return sessions.slice(0, 5)
  }
  return null
}

export function answerFamilyQuestion(question: string, sessions: SessionEvent[]): string {
  if (sessions.length === 0) {
    return '目前還沒有測試紀錄。請先完成一次坐站測試並儲存結果，再回到這裡查看家屬摘要。'
  }

  const lower = question.toLowerCase()
  const summary = generateTrendSummary(sessions)
  const latest = sessions[0]
  const unstable = sessions.filter((s) => s.level === 'review')
  const caution = sessions.filter((s) => s.level === 'attention')
  const tiltMax = [...sessions].sort((a, b) => b.tiltMaxDeg - a.tiltMaxDeg)[0]

  // ── 趨勢方向 ──────────────────────────────────────────────
  const isTrendQuery =
    lower.includes('進步') || lower.includes('改善') || lower.includes('變好') ||
    lower.includes('退步') || lower.includes('變差') || lower.includes('變慢') ||
    lower.includes('變快') || lower.includes('趨勢') || lower.includes('有沒有好')

  if (isTrendQuery) {
    if (sessions.length < 4) {
      return `目前只有 ${sessions.length} 筆紀錄，需要至少 4 筆才能判斷趨勢。現有最新：${generateSessionSummary(latest)}`
    }
    const recentAvg = sessions.slice(0, 3).reduce((s, x) => s + x.avgDurationSec, 0) / 3
    const olderCount = Math.min(sessions.length - 3, 3)
    const olderAvg = sessions.slice(3, 3 + olderCount).reduce((s, x) => s + x.avgDurationSec, 0) / olderCount
    const delta = recentAvg - olderAvg
    const deltaStr = Math.abs(delta).toFixed(1)
    if (Math.abs(delta) < 0.3) {
      return `速度趨勢穩定，最近 3 筆平均 ${recentAvg.toFixed(1)}s，與前幾筆 ${olderAvg.toFixed(1)}s 相差不大。建議持續觀察。`
    } else if (delta > 0) {
      return `速度有略微變慢的趨勢：最近 3 筆平均 ${recentAvg.toFixed(1)}s，比前幾筆 ${olderAvg.toFixed(1)}s 慢了 ${deltaStr}s。若持續超過一週，建議諮詢物理治療師。`
    } else {
      return `速度有改善趨勢：最近 3 筆平均 ${recentAvg.toFixed(1)}s，比前幾筆 ${olderAvg.toFixed(1)}s 快了 ${deltaStr}s。請持續保持。`
    }
  }

  // ── 時間範圍查詢 ─────────────────────────────────────────
  const timeSessions = filterByTimeKeyword(sessions, lower)
  if (timeSessions !== null) {
    if (timeSessions.length === 0) {
      const period = lower.includes('今天') || lower.includes('今日') ? '今天' :
        lower.includes('昨天') ? '昨天' :
        lower.includes('本週') || lower.includes('這週') ? '本週' :
        lower.includes('上週') ? '上週' : '指定時段'
      return `${period}沒有測試紀錄。最新的測試是在 ${formatSessionDate(latest.timestamp)}。`
    }
    const count = timeSessions.length
    const badCount = timeSessions.filter((s) => s.level !== 'smooth').length
    const avgDur = (timeSessions.reduce((s, x) => s + x.avgDurationSec, 0) / count).toFixed(1)
    const details = timeSessions.slice(0, 2).map(generateSessionSummary).join(' ')
    return `共 ${count} 筆，平均每次耗時 ${avgDur}s，其中 ${badCount} 筆需留意。詳細：${details}`
  }

  // ── 與上次比較 ────────────────────────────────────────────
  if (lower.includes('比上次') || lower.includes('跟上次') || lower.includes('和上次') ||
      lower.includes('比之前') || lower.includes('比較') || lower.includes('上次')) {
    if (sessions.length < 2) {
      return `只有 1 筆紀錄，無法比較。最新：${generateSessionSummary(latest)}`
    }
    const prev = sessions[1]
    const dDelta = latest.avgDurationSec - prev.avgDurationSec
    const tDelta = latest.tiltMaxDeg - prev.tiltMaxDeg
    const faster = dDelta < 0
    return `最新一次（${formatSessionDate(latest.timestamp)}）比前一次（${formatSessionDate(prev.timestamp)}）` +
      `速度${faster ? '快' : '慢'}了 ${Math.abs(dDelta).toFixed(1)}s，` +
      `偏斜${tDelta > 0 ? '增加' : '減少'}了 ${Math.abs(Math.round(tDelta))} 度。` +
      `目前狀態：「${levelLabel(latest.level)}」。`
  }

  // ── 速度查詢 ──────────────────────────────────────────────
  if (lower.includes('速度') || lower.includes('快不快') || lower.includes('幾秒') ||
      lower.includes('時間') || lower.includes('多久') || lower.includes('慢不慢') ||
      lower.includes('幾分鐘')) {
    const avg = summary.avgDurationSec?.toFixed(1) ?? '-'
    const fastest = [...sessions].sort((a, b) => a.avgDurationSec - b.avgDurationSec)[0]
    const slowest = [...sessions].sort((a, b) => b.avgDurationSec - a.avgDurationSec)[0]
    return `最新一次平均每次坐站耗時 ${latest.avgDurationSec.toFixed(1)}s，近 ${sessions.slice(0,7).length} 筆平均 ${avg}s。` +
      `最快是 ${formatSessionDate(fastest.timestamp)} 的 ${fastest.avgDurationSec.toFixed(1)}s，` +
      `最慢是 ${formatSessionDate(slowest.timestamp)} 的 ${slowest.avgDurationSec.toFixed(1)}s。` +
      `（文獻基準：60-69 歲平均 2.28s/次；>3.34s/次 屬高風險 — Bohannon 2006）`
  }

  // ── 偏斜查詢 ──────────────────────────────────────────────
  if (lower.includes('偏斜') || lower.includes('左右') || lower.includes('歪') ||
      lower.includes('傾斜') || lower.includes('平衡') || lower.includes('肩膀')) {
    return `偏斜最嚴重的是 ${formatSessionDate(tiltMax.timestamp)}，最大肩膀偏斜 ${tiltMax.tiltMaxDeg.toFixed(0)} 度（狀態：「${levelLabel(tiltMax.level)}」）。` +
      `最新一次偏斜 ${latest.tiltMaxDeg.toFixed(0)} 度。若連續偏斜超過 20 度，建議觀察是否固定往同一側傾斜並諮詢專業人員。`
  }

  // ── 不穩定查詢 ────────────────────────────────────────────
  if (lower.includes('不穩') || lower.includes('哪天') || lower.includes('哪次') ||
      lower.includes('危險') || lower.includes('需陪同') || lower.includes('最差')) {
    if (unstable.length === 0) {
      return '目前沒有被標記為「需陪同」的紀錄。建議持續觀察，若出現連續兩次「留意」則需要更積極跟進。'
    }
    const detail = generateSessionSummary(unstable[0])
    return `最需要留意的是 ${detail}` +
      (unstable.length > 1 ? ` 共有 ${unstable.length} 次「需陪同」紀錄。` : '')
  }

  // ── 晃動查詢 ──────────────────────────────────────────────
  if (lower.includes('晃動') || lower.includes('搖晃') || lower.includes('不穩定') ||
      lower.includes('晃')) {
    const totalSway = summary.totalInstabilityEvents
    const recentN = sessions.slice(0, 7).length
    const swayAvg = recentN > 0 ? (totalSway / recentN).toFixed(1) : '-'
    return `近期 ${recentN} 筆共有 ${totalSway} 次晃動事件，平均每次測試 ${swayAvg} 次。` +
      `最新一次：${latest.instabilityEvents} 次。（單次 2 次以上為高風險訊號）`
  }

  // ── 留意紀錄查詢 ─────────────────────────────────────────
  if (lower.includes('留意') || lower.includes('警示') || lower.includes('注意') ||
      lower.includes('警告')) {
    const actionNote = latest.notes.find((n) => !n.includes('不是醫療診斷')) ?? latest.notes[0]
    return caution.length > 0
      ? `目前有 ${caution.length} 筆「留意」紀錄，最新是 ${formatSessionDate(caution[0].timestamp)}。` +
        `最新測試建議：${actionNote}`
      : `目前沒有「留意」紀錄。最新建議：${actionNote}`
  }

  // ── 整體狀況 / 摘要 ──────────────────────────────────────
  if (lower.includes('狀況') || lower.includes('如何') || lower.includes('怎樣') ||
      lower.includes('總結') || lower.includes('摘要') || lower.includes('報告') ||
      lower.includes('概況') || lower.includes('整體') || lower.includes('summary')) {
    return `目前共 ${summary.totalSessions} 筆，最新狀態「${levelLabel(summary.latestLevel)}」。` +
      `${summary.narrative} 最新：${generateSessionSummary(latest)}`
  }

  // ── 家人/照護行動建議 ────────────────────────────────────
  if (lower.includes('家人') || lower.includes('要做什麼') || lower.includes('怎麼辦') ||
      lower.includes('建議') || lower.includes('需要') || lower.includes('照護') ||
      lower.includes('該怎麼') || lower.includes('幫助')) {
    const level = latest.level
    if (level === 'review') {
      return '最新測試偵測到明顯偏移或晃動。建議：（1）請家人陪同觀察日常起身是否明顯費力或晃動；（2）確認操作環境安全；（3）若持續出現，安排物理治療師到宅評估。CareLoop 為居家觀察工具，不取代專業判斷。'
    } else if (level === 'attention') {
      return '最新測試有留意訊號。建議：（1）增加觀察頻率；（2）注意是否在疲累或特定時段表現較差；（3）若連續 3 次以上留意，考慮諮詢物理治療師。'
    }
    return '最新測試整體穩定。建議：（1）保持每週 2-3 次規律測試以追蹤趨勢；（2）若速度比平常明顯變慢或晃動增加，記錄並告知醫療人員。'
  }

  // ── 預設回應 ─────────────────────────────────────────────
  return `我可以回答以下問題：\n時間範圍（今天、昨天、本週、上週、上個月）、趨勢（有沒有進步、速度有沒有變慢）、指標（速度、偏斜、晃動、哪次最差）、比較（比上次如何）、照護建議（家人需要注意什麼）。\n\n最新測試：${generateSessionSummary(latest)}`
}

// ─────────────────────────────────────────────────────────────
// NarrativeAdapter 實作：規則式引擎 v2
// ─────────────────────────────────────────────────────────────
export class RuleBasedNarrativeAdapter implements NarrativeAdapter {
  generateSessionSummary(session: SessionEvent): string {
    return generateSessionSummary(session)
  }

  generateTrendNarrative(summary: TrendSummary): string {
    return summary.narrative
  }

  answerFamilyQuestion(question: string, sessions: SessionEvent[]): string {
    return answerFamilyQuestion(question, sessions)
  }
}

/** 預設全域實例（單例） */
export const defaultNarrativeAdapter: NarrativeAdapter = new RuleBasedNarrativeAdapter()
