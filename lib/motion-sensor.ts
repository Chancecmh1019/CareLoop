/**
 * lib/motion-sensor.ts
 *
 * DeviceMotionEvent 包裝器 — 陀螺儀 + 加速度計雙模態感知層
 *
 * 技術依據：
 *   - DeviceMotionEvent API (W3C)：https://www.w3.org/TR/orientation-event/
 *   - iOS 13+ 需要 DeviceMotionEvent.requestPermission()
 *   - 低通濾波器 (α = 0.2) 去除高頻雜訊，保留軀幹運動訊號
 *   - 對應文獻：Fraunhofer Institute 2025 smartphone STS validation;
 *               Stanford AgeLab 2024 inertial sensor mobility assessment
 *
 * 術語說明：
 *   acceleration：加速度 (m/s²)，不含重力
 *   rotationRate：角速度 (deg/s)，alpha/beta/gamma 對應三軸
 *   beta：前後傾斜（軀幹前後）
 *   gamma：左右傾斜（軀幹側傾）
 */

export interface SensorReading {
  /** 時間戳記 (ms) */
  timestampMs: number
  /** 側向加速度 (x 軸, m/s²) */
  lateralAcceleration: number
  /** 垂直加速度 (y 軸, m/s²) */
  verticalAcceleration: number
  /** 前後傾斜角速度 beta (deg/s) */
  pitchRate: number
  /** 側傾角速度 gamma (deg/s) */
  rollRate: number
  /** 感測器是否可用 */
  available: boolean
}

export interface SensorState {
  /** 最新讀數 */
  latest: SensorReading
  /** 感測器支援狀態 */
  supported: boolean
  /** 使用者是否已授權（iOS） */
  permitted: boolean
  /** 是否正在監聽 */
  listening: boolean
}

const EMPTY_READING: SensorReading = {
  timestampMs: 0,
  lateralAcceleration: 0,
  verticalAcceleration: 0,
  pitchRate: 0,
  rollRate: 0,
  available: false,
}

// 低通濾波器係數 (0 = 不濾波, 1 = 完全忽略新值)
const LPF_ALPHA = 0.2

function createLowPassFilter() {
  let prev: Omit<SensorReading, 'timestampMs' | 'available'> = {
    lateralAcceleration: 0,
    verticalAcceleration: 0,
    pitchRate: 0,
    rollRate: 0,
  }

  return function filter(
    lateral: number,
    vertical: number,
    pitch: number,
    roll: number,
  ) {
    prev = {
      lateralAcceleration: LPF_ALPHA * prev.lateralAcceleration + (1 - LPF_ALPHA) * lateral,
      verticalAcceleration: LPF_ALPHA * prev.verticalAcceleration + (1 - LPF_ALPHA) * vertical,
      pitchRate: LPF_ALPHA * prev.pitchRate + (1 - LPF_ALPHA) * pitch,
      rollRate: LPF_ALPHA * prev.rollRate + (1 - LPF_ALPHA) * roll,
    }
    return prev
  }
}

export type SensorCallback = (reading: SensorReading) => void

export function createMotionSensor() {
  let state: SensorState = {
    latest: { ...EMPTY_READING },
    supported: false,
    permitted: false,
    listening: false,
  }

  const listeners = new Set<SensorCallback>()
  const filter = createLowPassFilter()
  let handler: ((e: DeviceMotionEvent) => void) | null = null

  /** 檢查是否支援 DeviceMotionEvent */
  function isSupported(): boolean {
    return typeof window !== 'undefined' && 'DeviceMotionEvent' in window
  }

  /** 請求 iOS 13+ 的感測器授權 */
  async function requestPermission(): Promise<boolean> {
    if (!isSupported()) return false

    // iOS 13+ 需要明確授權
    const Evt = DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<PermissionState>
    }
    if (typeof Evt.requestPermission === 'function') {
      try {
        const result = await Evt.requestPermission()
        state = { ...state, permitted: result === 'granted' }
        return result === 'granted'
      } catch {
        state = { ...state, permitted: false }
        return false
      }
    }

    // Android/桌面瀏覽器不需要授權
    state = { ...state, permitted: true }
    return true
  }

  /** 開始監聽感測器 */
  async function start(): Promise<boolean> {
    if (!isSupported()) {
      state = { ...state, supported: false, listening: false }
      return false
    }

    state = { ...state, supported: true }

    const granted = await requestPermission()
    if (!granted) return false

    if (handler) {
      window.removeEventListener('devicemotion', handler)
    }

    handler = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity
      const rot = event.rotationRate

      const lateral = acc?.x ?? 0
      const vertical = acc?.y ?? 0
      const pitch = rot?.beta ?? 0
      const roll = rot?.gamma ?? 0

      const filtered = filter(lateral, vertical, pitch, roll)

      const reading: SensorReading = {
        timestampMs: performance.now(),
        ...filtered,
        available: true,
      }

      state = { ...state, latest: reading }
      for (const cb of listeners) cb(reading)
    }

    window.addEventListener('devicemotion', handler, { passive: true })
    state = { ...state, listening: true }
    return true
  }

  /** 停止監聽感測器 */
  function stop() {
    if (handler) {
      window.removeEventListener('devicemotion', handler)
      handler = null
    }
    state = { ...state, listening: false }
  }

  /** 訂閱感測器讀數 */
  function subscribe(cb: SensorCallback) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }

  function getState() {
    return { ...state }
  }

  return { start, stop, subscribe, getState, isSupported }
}

/** 計算垂直加速度峰值（用於站立事件驗證） */
export function detectVerticalPeak(readings: SensorReading[], windowMs = 500): number {
  const now = performance.now()
  const recent = readings.filter((r) => now - r.timestampMs < windowMs)
  if (recent.length === 0) return 0
  return Math.max(...recent.map((r) => Math.abs(r.verticalAcceleration)))
}

/** 計算側向搖晃強度（用於晃動事件驗證） */
export function detectLateralSway(readings: SensorReading[], windowMs = 500): number {
  const now = performance.now()
  const recent = readings.filter((r) => now - r.timestampMs < windowMs)
  if (recent.length === 0) return 0
  return Math.max(...recent.map((r) => Math.abs(r.lateralAcceleration)))
}
