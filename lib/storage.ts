import type { SessionEvent } from '@/lib/types'

export const STORAGE_KEY = 'careloop.sessions'



function isSessionEvent(value: unknown): value is SessionEvent {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<SessionEvent>
  return (
    typeof item.id === 'string' &&
    typeof item.timestamp === 'string' &&
    typeof item.reps === 'number' &&
    typeof item.totalDurationSec === 'number' &&
    typeof item.avgDurationSec === 'number' &&
    typeof item.tiltMaxDeg === 'number' &&
    typeof item.instabilityEvents === 'number' &&
    (item.level === 'smooth' || item.level === 'attention' || item.level === 'review') &&
    (item.trackingQuality === 'good' || item.trackingQuality === 'poor' || item.trackingQuality === 'lost') &&
    Array.isArray(item.notes)
  )
}

function sortSessions(sessions: SessionEvent[]) {
  return [...sessions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

export function getSessions(): SessionEvent[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return sortSessions(parsed.filter(isSessionEvent))
  } catch {
    return []
  }
}

export function setSessions(sessions: SessionEvent[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sortSessions(sessions)))
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      console.warn('localStorage quota exceeded. Dropping oldest sessions.')
      if (sessions.length > 20) {
        setSessions(sortSessions(sessions).slice(0, 20))
      }
    } else {
      console.error('Failed to save sessions:', e)
    }
  }
}

export function saveSession(session: SessionEvent): void {
  setSessions([session, ...getSessions().filter((item) => item.id !== session.id)])
}

export function clearSessions(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function exportSessions(): string {
  return JSON.stringify(getSessions(), null, 2)
}

export function importSessions(json: string): SessionEvent[] {
  const parsed = JSON.parse(json)
  if (!Array.isArray(parsed) || !parsed.every(isSessionEvent)) {
    throw new Error('匯入檔案不是有效的 CareLoop 紀錄。')
  }
  const sessions = sortSessions(parsed)
  setSessions(sessions)
  return sessions
}
