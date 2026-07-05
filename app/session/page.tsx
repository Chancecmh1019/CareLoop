'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart2,
  Camera,
  CheckCircle2,
  Home,
  Play,
  RotateCcw,
  Save,
  Square,
  Smartphone,
  UserRound,
  XCircle,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { PoseCanvas } from '@/components/PoseCanvas'
import { notifyCoachAction, notifyStatus } from '@/lib/action-engine'
import { createCoachingEngine } from '@/lib/coaching-engine'
import { evaluateSession, levelLabel, MOTION_THRESHOLDS } from '@/lib/decision-engine'
import { createMotionAnalyzer, checkEnvironment } from '@/lib/motion-analyzer'
import { createMotionSensor } from '@/lib/motion-sensor'
import { fuseModalities, getSensorStatusLabel } from '@/lib/sensor-fusion'
import { saveSession, getSessions } from '@/lib/storage'
import { computePersonalBaseline, computeDeviation, describeDeviation } from '@/lib/adaptive-baseline'
import type {
  CoachAction,
  EnvironmentQuality,
  FusedMetric,
  LandmarkLike,
  MotionSnapshot,
  ObservationLevel,
  SessionEvent,
} from '@/lib/types'
import { cn } from '@/lib/utils'

type HudStatus = 'setup' | 'ready' | 'smooth' | 'attention' | 'review' | 'tracking-lost'

const EMPTY_SNAPSHOT: MotionSnapshot = {
  reps: 0,
  nextAction: 'hold',
  totalDurationSec: 0,
  avgDurationSec: 0,
  tiltMaxDeg: 0,
  tiltSignedDeg: 0,
  instabilityEvents: 0,
  trackingQuality: 'lost',
  latestMetric: null,
  complete: false,
}

const EMPTY_FUSED: FusedMetric = {
  swayConfidence: 0,
  standQuality: 0,
  isFused: false,
  lateralSwayMs2: 0,
  verticalPeakMs2: 0,
  visualSNR: 0,
  inertialSNR: 0,
  method: 'no_data',
}

const EMPTY_SENSOR_READING = {
  available: false,
  lateralAcceleration: 0,
  verticalAcceleration: 0,
  timestampMs: 0,
  pitchRate: 0,
  rollRate: 0,
}

const AUTO_START_SECONDS = 8

const statusTone: Record<HudStatus, string> = {
  setup: 'ring-white/10',
  ready: 'ring-[#2D5F5D]/55',
  smooth: 'ring-[#2F855A]/75',
  attention: 'ring-[#D97706]/80',
  review: 'ring-[#DC2626]/90 shadow-[0_0_80px_rgba(220,38,38,0.75)]',
  'tracking-lost': 'ring-white/70',
}

function HudButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  tone = 'dark',
  wide = false,
}: {
  label: string
  icon: typeof Camera
  onClick: () => void
  disabled?: boolean
  tone?: 'dark' | 'primary' | 'green' | 'red'
  wide?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex min-h-14 min-w-0 touch-manipulation select-none items-center justify-center gap-1.5 rounded-2xl border border-white/20 px-2 text-xs font-black text-white shadow-2xl backdrop-blur-md transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[72px] sm:min-w-[72px] sm:gap-2 sm:px-4 sm:text-sm',
        wide && 'col-span-2 px-3 text-sm sm:min-w-[160px] sm:px-6 sm:text-base',
        tone === 'dark' && 'bg-black/55 hover:bg-black/70',
        tone === 'primary' && 'bg-[#2D5F5D]/90 hover:bg-[#244C4A]',
        tone === 'green' && 'bg-[#2F855A]/95 hover:bg-[#276749]',
        tone === 'red' && 'bg-[#DC2626]/95 hover:bg-[#B91C1C]',
      )}
    >
      <Icon className="h-6 w-6 shrink-0 sm:h-8 sm:w-8" aria-hidden="true" />
      {wide && <span>{label}</span>}
    </button>
  )
}

function SwayWaveform({ values, isFused }: { values: number[]; isFused: boolean }) {
  const maxValue = 3
  const width = 80
  const points = values
    .slice(-width)
    .map((value, index) => {
      const normalized = Math.min(Math.abs(value) / maxValue, 1)
      const x = (index / (width - 1)) * 100
      const y = 50 - normalized * 45
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="flex items-center gap-1.5">
      <Activity className={cn('h-3.5 w-3.5 shrink-0', isFused ? 'text-[#4EB8B4]' : 'text-white/40')} aria-hidden="true" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-7 w-16" aria-hidden="true">
        <polyline
          points={points}
          fill="none"
          stroke={isFused ? '#4EB8B4' : 'rgba(255,255,255,0.3)'}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[9px] font-black text-white/50">{isFused ? '雙模態' : '陀螺儀'}</span>
    </div>
  )
}

type CoachCueMode = CoachAction | 'realign' | 'ready' | 'camera' | 'setup'

interface CoachCue {
  mode: CoachCueMode
  title: string
  body: string
  action: CoachAction | 'realign' | null
  tone: 'neutral' | 'stand' | 'sit' | 'ready' | 'warning' | 'done'
}

function getCoachCueForDisplay({
  analyzing,
  autoStartCountdown,
  cameraOn,
  envQuality,
  snapshot,
  showCompletion,
}: {
  analyzing: boolean
  autoStartCountdown: number | null
  cameraOn: boolean
  envQuality: EnvironmentQuality | null
  snapshot: MotionSnapshot
  showCompletion: boolean
}): CoachCue {
  if (showCompletion || snapshot.nextAction === 'complete') {
    return { mode: 'complete', title: '完成了', body: '先坐穩休息一下，結果已經整理好。', action: 'complete', tone: 'done' }
  }

  if (!cameraOn) {
    return { mode: 'camera', title: '先開啟相機', body: '開啟後走到椅子位置；全身入鏡後會自動倒數開始。', action: null, tone: 'neutral' }
  }

  if (!analyzing) {
    if (!envQuality) {
      return { mode: 'setup', title: '正在看鏡頭', body: '請走到椅子位置，讓頭、身體和膝蓋都入鏡。', action: null, tone: 'neutral' }
    }
    if (envQuality.personMissing) {
      return { mode: 'realign', title: '請回到鏡頭中央', body: '我還沒有看到完整身體，請再調整位置。', action: 'realign', tone: 'warning' }
    }
    if (envQuality.bodyIncomplete) {
      return { mode: 'realign', title: '請讓全身入鏡', body: '我需要看見頭、身體、膝蓋和腳踝，才能準確開始測驗。', action: 'realign', tone: 'warning' }
    }
    if (!envQuality.ready) {
      return { mode: 'setup', title: '調整拍攝位置', body: '請讓全身入鏡並保持光線充足，準備好後會自動開始。', action: null, tone: 'warning' }
    }

    return {
      mode: 'ready',
      title: autoStartCountdown === null ? '坐好後會自動開始' : `${autoStartCountdown} 秒後自動開始`,
      body: '不用回來按開始。請坐穩、雙腳踩地，倒數完我會開始測驗。',
      action: 'hold',
      tone: 'ready',
    }
  }

  if (snapshot.trackingQuality === 'lost') {
    return { mode: 'realign', title: '回到鏡頭中央', body: '我看不到完整身體，請先回到畫面中間。', action: 'realign', tone: 'warning' }
  }

  if (snapshot.nextAction === 'sit') {
    return { mode: 'sit', title: '現在慢慢坐下', body: '坐到椅子上，停穩後我會幫你計一次。', action: 'sit', tone: 'sit' }
  }

  if (snapshot.nextAction === 'stand') {
    if (snapshot.reps === 0) {
      return {
        mode: 'stand',
        title: '掃描完成！測驗開始',
        body: '請開始第 1 次起立！用穩定速度站直，眼睛看前方。',
        action: 'stand',
        tone: 'stand',
      }
    }
    return {
      mode: 'stand',
      title: `第 ${Math.min(snapshot.reps + 1, MOTION_THRESHOLDS.TARGET_REPS)} 次，站起來`,
      body: '用穩定速度站直，眼睛看前方。',
      action: 'stand',
      tone: 'stand',
    }
  }

  return { mode: 'hold', title: '先坐穩', body: '我正在建立坐姿基準，保持身體在鏡頭中央。', action: 'hold', tone: 'ready' }
}

function CoachFigure({ mode }: { mode: CoachCueMode }) {
  const isSit = mode === 'sit' || mode === 'ready' || mode === 'hold'
  const isStand = mode === 'stand'
  const Icon = mode === 'sit' ? ArrowDown : mode === 'stand' ? ArrowUp : UserRound

  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 sm:h-32 sm:w-32">
      <div className={cn('absolute bottom-5 h-3 rounded-full bg-white/25 transition-all duration-300', isSit ? 'w-20' : 'w-14')} />
      <div className={cn('absolute flex flex-col items-center transition-all duration-300', isSit ? 'bottom-8' : 'bottom-10', isStand && '-translate-y-3')}>
        <div className="h-6 w-6 rounded-full bg-white shadow-lg" />
        <div className={cn('mt-1 w-5 rounded-full bg-white transition-all duration-300', isSit ? 'h-9' : 'h-14')} />
        <div className={cn('mt-1 flex gap-2 transition-all duration-300', isSit ? 'translate-y-0' : 'translate-y-1')}>
          <div className={cn('w-2 rounded-full bg-white', isSit ? 'h-7 rotate-45' : 'h-10')} />
          <div className={cn('w-2 rounded-full bg-white', isSit ? 'h-7 -rotate-45' : 'h-10')} />
        </div>
      </div>
      <div className={cn('absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full', mode === 'stand' ? 'bg-[#2F855A]' : mode === 'sit' ? 'bg-[#D97706]' : mode === 'realign' ? 'bg-[#DC2626]' : 'bg-[#2D5F5D]')}>
        <Icon className="h-5 w-5 text-white" aria-hidden="true" />
      </div>
    </div>
  )
}

function CoachCuePanel({ cue, reps }: { cue: CoachCue; reps: number }) {
  const toneClass = {
    neutral: 'border-white/20 bg-black/58',
    stand: 'border-[#2F855A]/60 bg-[#173B2A]/82',
    sit: 'border-[#D97706]/65 bg-[#3B2A12]/84',
    ready: 'border-[#2D5F5D]/65 bg-[#143C3A]/82',
    warning: 'border-[#DC2626]/70 bg-[#3A1111]/86',
    done: 'border-[#2F855A]/70 bg-[#173B2A]/88',
  }[cue.tone]

  return (
    <div className={cn('pointer-events-none mx-auto flex max-w-2xl items-center gap-4 rounded-[1.5rem] border px-4 py-4 text-white shadow-2xl backdrop-blur-md sm:gap-5 sm:px-6', toneClass)}>
      <CoachFigure mode={cue.mode} />
      <div className="min-w-0 flex-1">
        <div className="mb-2 inline-flex rounded-full bg-white/12 px-3 py-1 text-xs font-black text-white/80">
          {reps}/{MOTION_THRESHOLDS.TARGET_REPS} 次
        </div>
        <div className="text-2xl font-black leading-tight sm:text-4xl">{cue.title}</div>
        <div className="mt-2 text-sm font-bold leading-6 text-white/82 sm:text-base">{cue.body}</div>
      </div>
    </div>
  )
}

function CompletionOverlay({
  session,
  isSaved,
  baseline,
  onSave,
  onRetry,
}: {
  session: SessionEvent
  isSaved: boolean
  baseline: ReturnType<typeof computePersonalBaseline>
  onSave: () => void
  onRetry: () => void
}) {
  const deviation = computeDeviation(
    { avgDurationSec: session.avgDurationSec, tiltMaxDeg: session.tiltMaxDeg, instabilityEvents: session.instabilityEvents },
    baseline,
  )
  const levelColor = session.level === 'smooth' ? '#2F855A' : session.level === 'attention' ? '#D97706' : '#DC2626'
  const levelBg = session.level === 'smooth' ? 'bg-[#2F855A]/20' : session.level === 'attention' ? 'bg-[#D97706]/20' : 'bg-[#DC2626]/20'
  const ResultIcon = session.level === 'smooth' ? CheckCircle2 : session.level === 'attention' ? AlertTriangle : XCircle

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="測試結果">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="relative mx-3 mb-3 w-full max-w-lg rounded-3xl border border-white/20 bg-[#111]/95 p-5 shadow-2xl sm:mx-4 sm:mb-0">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-lg font-black text-white">測試完成</div>
          {isSaved && <span className="rounded-full bg-[#2F855A]/30 px-3 py-1 text-xs font-black text-[#4EB8B4]">已儲存</span>}
        </div>

        <div className={cn('mb-4 flex items-center gap-3 rounded-2xl p-4', levelBg)}>
          <ResultIcon className="h-10 w-10 shrink-0" style={{ color: levelColor }} aria-hidden="true" />
          <div>
            <div className="text-2xl font-black" style={{ color: levelColor }}>{levelLabel(session.level)}</div>
            <div className="text-sm text-white/70">完成 {session.reps}/{MOTION_THRESHOLDS.TARGET_REPS} 次坐站</div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-2">
          {[
            { label: '5次總計', value: `${session.totalDurationSec.toFixed(1)}s` },
            { label: '單次平均', value: `${session.avgDurationSec.toFixed(1)}s` },
            { label: '最大偏斜', value: `${session.tiltMaxDeg.toFixed(0)}°` },
            { label: '晃動', value: `${session.instabilityEvents}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-white/8 p-2.5 text-center">
              <div className="text-[10px] font-bold text-white/55">{label}</div>
              <div className="mt-0.5 text-base font-black text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="mb-4 rounded-xl bg-white/6 px-3 py-2.5">
          <div className="mb-1 text-[10px] font-black text-white/50">個人基準線比較</div>
          <div className="text-xs font-bold leading-5 text-white/80">{describeDeviation(deviation, baseline)}</div>
          {deviation.isPersonalAnomaly && <div className="mt-1 text-[10px] font-bold text-[#D97706]">超出個人正常變動範圍（均值 +2SD）</div>}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {!isSaved ? (
            <button type="button" onClick={onSave} className="col-span-1 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#2D5F5D] font-black text-white active:scale-95 sm:col-span-2">
              <Save className="h-5 w-5" aria-hidden="true" />
              儲存結果
            </button>
          ) : (
            <Link href="/history" className="col-span-1 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#2D5F5D] font-black text-white sm:col-span-2">
              <BarChart2 className="h-5 w-5" aria-hidden="true" />
              查看紀錄
            </Link>
          )}
          <button type="button" onClick={onRetry} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 font-black text-white active:scale-95">
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
            再測一次
          </button>
        </div>

      </div>
    </div>
  )
}

function PreTestInstructions({ onStart }: { onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-white/20 bg-[#1A1A1A] p-6 shadow-2xl sm:p-8">
        <h2 className="mb-6 text-center text-2xl font-black text-white">5 次坐站測試 (FTSST) 準備指南</h2>
        
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2D5F5D]/30 text-[#4EB8B4]">
              <Camera className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="text-lg font-black text-white">1. 鏡頭架設</div>
              <div className="mt-1 text-sm font-bold leading-relaxed text-white/70">請將手機或電腦放在正前方約 2~3 公尺處。高度建議與腰部齊平，確保起立和坐下時「全身（頭到腳）」都能完整入鏡。</div>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#D97706]/30 text-[#F59E0B]">
              <UserRound className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="text-lg font-black text-white">2. 座椅與姿勢</div>
              <div className="mt-1 text-sm font-bold leading-relaxed text-white/70">請使用無輪子、高度約 43-45 公分的硬面椅子（如一般餐椅）。測試全程請「雙手交叉抱胸」，勿用手撐扶手或大腿。</div>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2F855A]/30 text-[#4ADE80]">
              <ArrowUp className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="text-lg font-black text-white">3. 測試進行</div>
              <div className="mt-1 text-sm font-bold leading-relaxed text-white/70">開啟相機後，走到椅子前坐好。系統偵測到您入鏡後會自動倒數。聽到指令後，請以最快且安全的速度連續起立並坐下 5 次。</div>
            </div>
          </div>
        </div>
        
        <button type="button" onClick={onStart} className="mt-8 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#2D5F5D] text-lg font-black text-white transition-transform active:scale-95">
          <Camera className="h-6 w-6" aria-hidden="true" />
          我準備好了，開啟相機
        </button>
      </div>
    </div>
  )
}

export default function SessionPage() {
  const analyzerRef = useRef(createMotionAnalyzer())
  const coachRef = useRef(createCoachingEngine())
  const sensorRef = useRef(createMotionSensor())
  const containerRef = useRef<HTMLDivElement>(null)
  const lastNotifiedRef = useRef<HudStatus>('setup')
  const lastRepCountRef = useRef(0)
  const latestSensorRef = useRef(EMPTY_SENSOR_READING)
  const completionHandledRef = useRef(false)
  const lastCoachCueRef = useRef('')

  const [cameraOn, setCameraOn] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [sensorOn, setSensorOn] = useState(false)
  const [sensorSupported, setSensorSupported] = useState(false)
  const [status, setStatus] = useState<HudStatus>('setup')
  const [snapshot, setSnapshot] = useState<MotionSnapshot>(EMPTY_SNAPSHOT)
  const [fused, setFused] = useState<FusedMetric>(EMPTY_FUSED)
  const [latestSensor, setLatestSensor] = useState(EMPTY_SENSOR_READING)
  const [swayHistory, setSwayHistory] = useState<number[]>(Array(80).fill(0))
  const [completedSession, setCompletedSession] = useState<SessionEvent | null>(null)
  const [showCompletion, setShowCompletion] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null)
  const [envQuality, setEnvQuality] = useState<EnvironmentQuality | null>(null)
  const [baseline, setBaseline] = useState(() => computePersonalBaseline(getSessions()))

  const analyzingRef = useRef(false)
  const lastEnvCheckRef = useRef(0)

  useEffect(() => { analyzingRef.current = analyzing }, [analyzing])
  useEffect(() => { latestSensorRef.current = latestSensor }, [latestSensor])
  useEffect(() => { setSensorSupported(sensorRef.current.isSupported()) }, [])
  useEffect(() => {
    const sensor = sensorRef.current
    return () => { sensor.stop() }
  }, [])

  useEffect(() => {
    if (!sensorOn) return
    const unsub = sensorRef.current.subscribe((reading) => {
      setLatestSensor(reading)
      setSwayHistory((prev) => [...prev.slice(-79), reading.lateralAcceleration])
    })
    return () => { unsub() }
  }, [sensorOn])

  const currentStatus = snapshot.trackingQuality === 'lost' && analyzing ? 'tracking-lost' : status

  const requestFullscreen = useCallback(() => {
    const el = containerRef.current ?? document.documentElement
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
    else if ('webkitRequestFullscreen' in el) (el as HTMLElement & { webkitRequestFullscreen: () => void }).webkitRequestFullscreen()
  }, [])

  const exitFullscreen = () => {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {})
    else if ('webkitExitFullscreen' in document) (document as Document & { webkitExitFullscreen: () => void }).webkitExitFullscreen()
  }

  const handleLandmarks = useCallback((landmarks: LandmarkLike[] | undefined, worldLandmarks: LandmarkLike[] | undefined, timestampMs: number, videoWidth: number, videoHeight: number) => {
    if (!analyzingRef.current && timestampMs - lastEnvCheckRef.current > 500) {
      lastEnvCheckRef.current = timestampMs
      setEnvQuality(checkEnvironment(landmarks, videoWidth, videoHeight))
    }
    if (!analyzingRef.current) return analyzerRef.current.getSnapshot()
    return analyzerRef.current.processFrame(landmarks, worldLandmarks, timestampMs, videoWidth, videoHeight)
  }, [])

  const handleSnapshot = useCallback((next: MotionSnapshot) => {
    setSnapshot(next)
    if (!analyzing) return

    const fusedResult = fuseModalities(next, latestSensorRef.current)
    setFused(fusedResult)

    if (next.trackingQuality === 'lost') {
      setStatus('tracking-lost')
      return
    }

    if (next.complete && !completionHandledRef.current) {
      completionHandledRef.current = true
      const decision = evaluateSession({ ...next, swayConfidence: fusedResult.swayConfidence })
      setStatus(decision.level)
      setAnalyzing(false)
      exitFullscreen()
      setCompletedSession(analyzerRef.current.createSession())
      setShowCompletion(true)
      return
    }

    const decision = evaluateSession({ ...next, swayConfidence: fusedResult.swayConfidence })
    setStatus(decision.level === 'review' ? 'attention' : decision.level)
    let lastRepSec = 0
    if (next.reps > lastRepCountRef.current) {
      lastRepSec = next.avgDurationSec
      lastRepCountRef.current = next.reps
    }
    coachRef.current.evaluate({
      shoulderTiltDeg: next.latestMetric?.shoulderTiltDeg ?? null,
      lateralSwayMs2: fusedResult.lateralSwayMs2,
      motionState: next.latestMetric?.motionState ?? 'unknown',
      lastRepSec,
      reps: next.reps,
      trackingQuality: next.trackingQuality,
    })
  }, [analyzing])

  const resetTest = useCallback(() => {
    analyzerRef.current.reset()
    coachRef.current.reset()
    lastRepCountRef.current = 0
    completionHandledRef.current = false
    lastCoachCueRef.current = ''
    setSnapshot(EMPTY_SNAPSHOT)
    setFused(EMPTY_FUSED)
    setCompletedSession(null)
    setAnalyzing(false)
    setShowCompletion(false)
    setIsSaved(false)
    setAutoStartCountdown(null)
    setStatus(cameraOn ? 'ready' : 'setup')
    setBaseline(computePersonalBaseline(getSessions()))
  }, [cameraOn])

  const handlePoseError = useCallback((error: string) => {
    setCameraOn(false)
    setAnalyzing(false)
    setStatus('setup')
    console.error('PoseCanvas error:', error)
  }, [])

  const toggleCamera = () => {
    if (cameraOn) {
      setCameraOn(false)
      resetTest()
      setStatus('setup')
      return
    }
    setCameraOn(true)
    setStatus('ready')
  }

  const toggleSensor = async () => {
    if (sensorOn) {
      sensorRef.current.stop()
      setSensorOn(false)
      return
    }
    const granted = await sensorRef.current.start()
    if (granted) setSensorOn(true)
  }

  const startTest = useCallback(() => {
    analyzerRef.current.reset()
    coachRef.current.reset()
    lastRepCountRef.current = 0
    completionHandledRef.current = false
    lastCoachCueRef.current = ''
    setAutoStartCountdown(null)
    setSnapshot(EMPTY_SNAPSHOT)
    setFused(EMPTY_FUSED)
    setCompletedSession(null)
    setShowCompletion(false)
    setIsSaved(false)
    setStatus('smooth')
    setAnalyzing(true)
    requestFullscreen()
  }, [requestFullscreen])

  const canAutoStart =
    cameraOn &&
    !analyzing &&
    !showCompletion &&
    snapshot.reps === 0 &&
    envQuality?.ready === true

  useEffect(() => {
    if (!canAutoStart) {
      const resetTimer = window.setTimeout(() => setAutoStartCountdown(null), 0)
      return () => window.clearTimeout(resetTimer)
    }

    const primeTimer = window.setTimeout(() => {
      setAutoStartCountdown((current) => {
        if (current === null) {
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance('掃描完成。測驗即將開始，請連續站直再坐下五次，用您平時的自然速度進行。')
            utterance.lang = 'zh-TW'
            utterance.rate = 1.0
            window.speechSynthesis.speak(utterance)
          }
          return AUTO_START_SECONDS
        }
        return current
      })
    }, 0)
    const timer = window.setInterval(() => {
      setAutoStartCountdown((current) => {
        if (current === null) return AUTO_START_SECONDS
        if (current <= 1) {
          window.clearInterval(timer)
          startTest()
          return null
        }
        return current - 1
      })
    }, 1000)

    return () => {
      window.clearTimeout(primeTimer)
      window.clearInterval(timer)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [canAutoStart, startTest])

  const stopTest = () => {
    setAnalyzing(false)
    setAutoStartCountdown(null)
    coachRef.current.reset()
    setStatus(cameraOn ? 'ready' : 'setup')
  }

  const saveCurrent = () => {
    if (!completedSession) return
    saveSession(completedSession)
    setIsSaved(true)
    setBaseline(computePersonalBaseline(getSessions()))
  }

  useEffect(() => {
    if (currentStatus === lastNotifiedRef.current) return
    lastNotifiedRef.current = currentStatus
    if (['smooth', 'attention', 'review', 'tracking-lost'].includes(currentStatus)) {
      notifyStatus(currentStatus as ObservationLevel | 'tracking-lost', {
        speech: currentStatus === 'tracking-lost',
      })
    }
  }, [currentStatus])

  const tiltForCanvas = analyzing ? snapshot.tiltSignedDeg : null
  const coachCue = getCoachCueForDisplay({ analyzing, autoStartCountdown, cameraOn, envQuality, snapshot, showCompletion })

  useEffect(() => {
    if (!coachCue.action) return
    if (!analyzing && coachCue.action !== 'hold' && coachCue.action !== 'realign' && coachCue.action !== 'complete') return

    const key = `${coachCue.action}:${snapshot.reps}:${analyzing}:${snapshot.nextAction}:${snapshot.trackingQuality}`
    if (lastCoachCueRef.current === key) return
    lastCoachCueRef.current = key
    notifyCoachAction(coachCue.action, {
      reps: snapshot.reps,
      target: MOTION_THRESHOLDS.TARGET_REPS,
      speech: coachCue.action === 'realign' || coachCue.action === 'complete',
      interrupt: coachCue.action === 'realign',
    })
  }, [analyzing, coachCue.action, snapshot.nextAction, snapshot.reps, snapshot.trackingQuality])

  return (
    <div ref={containerRef} className="h-dvh max-h-dvh overflow-hidden bg-[#F4EDE4] p-2 text-white sm:p-4">
      <main className={cn('relative h-full w-full overflow-hidden rounded-[1.75rem] bg-black shadow-2xl ring-4 transition-all duration-300', statusTone[currentStatus])}>
        <PoseCanvas
          active={cameraOn}
          analyzing={analyzing}
          showChrome={false}
          className="h-full min-h-full rounded-none"
          shoulderTiltDeg={tiltForCanvas}
          trackingQuality={snapshot.trackingQuality}
          onLandmarks={handleLandmarks}
          onSnapshot={handleSnapshot}
          onError={handlePoseError}
        />

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.72),transparent_30%,transparent_60%,rgba(0,0,0,0.85))]" />

        {!cameraOn && !showCompletion && (
          <PreTestInstructions onStart={toggleCamera} />
        )}

        {cameraOn && !showCompletion && (
          <section className="pointer-events-none absolute inset-x-3 top-[92px] z-20 sm:inset-x-6 sm:top-[112px]">
            <CoachCuePanel cue={coachCue} reps={snapshot.reps} />
          </section>
        )}

        <div className="absolute left-3 right-3 top-3 z-30 flex items-start justify-between gap-2 sm:left-5 sm:right-5 sm:top-5">
          <Link
            href="/"
            aria-label="回首頁"
            className="flex min-h-[60px] min-w-[60px] items-center justify-center rounded-2xl border border-white/20 bg-black/55 text-white shadow-2xl backdrop-blur-md transition hover:bg-black/70"
          >
            <Home className="h-7 w-7" aria-hidden="true" />
          </Link>

          <div
            className={cn(
              'flex min-h-[60px] min-w-[60px] flex-col items-center justify-center rounded-2xl border border-white/20 px-2 shadow-2xl backdrop-blur-md',
              sensorOn ? 'bg-[#2D5F5D]/85' : 'bg-black/55',
            )}
            title={sensorOn ? getSensorStatusLabel(fused) : '陀螺儀未啟用'}
          >
            <Smartphone className={cn('h-5 w-5', sensorOn ? 'text-[#4EB8B4]' : 'text-white/40')} aria-hidden="true" />
            {sensorOn && fused.isFused && <Zap className="mt-0.5 h-3 w-3 text-yellow-300" aria-hidden="true" />}
            <span className="mt-0.5 text-[9px] font-black text-white/60">{sensorOn ? (fused.isFused ? '雙模態' : '感測中') : '陀螺儀'}</span>
          </div>
        </div>

        {analyzing && (
          <section className="pointer-events-none absolute bottom-[150px] left-3 right-3 z-20 flex items-center gap-2 sm:bottom-[96px] sm:left-5 sm:right-5">
            <div className="flex flex-1 items-center gap-2 overflow-x-auto rounded-2xl border border-white/20 bg-black/55 px-3 py-2 shadow-2xl backdrop-blur-md">
              {[
                { label: '5次總計', val: `${snapshot.totalDurationSec.toFixed(1)}s` },
                { label: '單次平均', val: `${snapshot.avgDurationSec.toFixed(1)}s` },
                { label: '偏斜', val: `${snapshot.tiltMaxDeg.toFixed(0)}°` },
                { label: '晃動', val: `${snapshot.instabilityEvents}` },
              ].map(({ label, val }) => (
                <div key={label} className="flex min-w-[54px] flex-col items-center">
                  <span className="text-[10px] font-black text-white/55">{label}</span>
                  <span className="text-base font-black tabular-nums text-white">{val}</span>
                </div>
              ))}
              {sensorOn && (
                <>
                  <div className="mx-1 h-8 w-px bg-white/20" />
                  <SwayWaveform values={swayHistory} isFused={fused.isFused} />
                </>
              )}
            </div>
          </section>
        )}

        {cameraOn && !showCompletion && (
          <section className="absolute bottom-3 left-3 right-3 z-40 sm:bottom-4 sm:left-5 sm:right-5">
            <div className="grid grid-cols-4 gap-2 rounded-[1.25rem] border border-white/20 bg-black/60 p-2 shadow-2xl backdrop-blur-md sm:flex sm:items-center sm:justify-between sm:rounded-[1.75rem]">
              <HudButton label="關閉相機" icon={Camera} onClick={toggleCamera} tone="primary" />
              {!analyzing ? (
                <HudButton label="開始測試" icon={Play} onClick={startTest} disabled={envQuality ? !envQuality.ready : false} tone="green" wide />
              ) : (
                <HudButton label="停止" icon={Square} onClick={stopTest} tone="red" wide />
              )}
              {sensorSupported && (
                <HudButton label={sensorOn ? '關閉陀螺儀' : '開啟陀螺儀'} icon={Smartphone} onClick={toggleSensor} tone={sensorOn ? 'primary' : 'dark'} />
              )}
              {!analyzing && snapshot.reps > 0 && <HudButton label="儲存" icon={Save} onClick={saveCurrent} />}
              <HudButton label="重設" icon={RotateCcw} onClick={resetTest} />
            </div>
          </section>
        )}

        {showCompletion && completedSession && (
          <CompletionOverlay
            session={completedSession}
            isSaved={isSaved}
            baseline={baseline}
            onSave={saveCurrent}
            onRetry={resetTest}
          />
        )}
      </main>
    </div>
  )
}
