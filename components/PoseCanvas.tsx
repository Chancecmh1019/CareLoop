'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import type { LandmarkLike, MotionSnapshot } from '@/lib/types'
import { cn } from '@/lib/utils'

const MEDIAPIPE_WASM_PATH = '/mediapipe/wasm'
const POSE_MODEL_PATH = '/mediapipe/models/pose_landmarker_lite.task'

interface PoseCanvasProps {
  active: boolean
  analyzing: boolean
  className?: string
  showChrome?: boolean
  /** 目前偏斜角度，由 session page 傳入，用於繪製引導箭頭 */
  shoulderTiltDeg?: number | null
  /** 目前追蹤品質 */
  trackingQuality?: 'good' | 'poor' | 'lost'
  onLandmarks: (landmarks: LandmarkLike[] | undefined, worldLandmarks: LandmarkLike[] | undefined, timestampMs: number, videoWidth: number, videoHeight: number) => MotionSnapshot
  onSnapshot: (snapshot: MotionSnapshot) => void
  onError?: (message: string) => void
}

type PoseLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => { landmarks?: LandmarkLike[][]; worldLandmarks?: LandmarkLike[][] }
  close?: () => void
}

// ─────────────────────────────────────────────────────────────
// 骨架繪製
// ─────────────────────────────────────────────────────────────
function drawSkeleton(ctx: CanvasRenderingContext2D, points: LandmarkLike[], width: number, height: number) {
  const pairs = [
    [11, 12], // 肩膀
    [11, 23], // 左側身
    [12, 24], // 右側身
    [23, 24], // 髖部
    [11, 13], // 左上臂
    [12, 14], // 右上臂
    [23, 25], // 左大腿
    [24, 26], // 右大腿
    [25, 27], // 左小腿
    [26, 28], // 右小腿
  ]

  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(78, 184, 180, 0.96)'
  ctx.fillStyle = '#FFFFFF'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)'
  ctx.shadowBlur = 10

  for (const [a, b] of pairs) {
    const start = points[a]
    const end = points[b]
    if (!start || !end) continue
    ctx.beginPath()
    ctx.moveTo(start.x * width, start.y * height)
    ctx.lineTo(end.x * width, end.y * height)
    ctx.stroke()
  }

  for (const point of points) {
    if (!point) continue
    ctx.beginPath()
    ctx.arc(point.x * width, point.y * height, 5, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ─────────────────────────────────────────────────────────────
// 視覺引導箭頭（AR-style 即時偏斜指引）
//
// 設計：偵測到偏斜時在骨架上疊加方向箭頭，告訴使用者
//       應該往哪個方向調整重心。這是「行動層視覺引導」
//       的具體實現，讓 Physical AI 的閉環有視覺可見的形式。
// ─────────────────────────────────────────────────────────────
function drawGuidanceOverlay(
  ctx: CanvasRenderingContext2D,
  points: LandmarkLike[],
  width: number,
  height: number,
  tiltDeg: number | null | undefined,
) {
  if (tiltDeg === null || tiltDeg === undefined) return

  const TILT_MILD = 12
  const TILT_SEVERE = 25
  const absTilt = Math.abs(tiltDeg)

  if (absTilt < TILT_MILD) {
    // Tilt within safe range — draw a subtle center line (stability indicator)
    ctx.save()
    ctx.setLineDash([8, 6])
    ctx.strokeStyle = 'rgba(47, 133, 90, 0.55)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(width * 0.5, height * 0.05)
    ctx.lineTo(width * 0.5, height * 0.95)
    ctx.stroke()
    ctx.restore()
    return
  }

  // Use shoulder midpoint as arrow anchor
  const ls = points[11]
  const rs = points[12]
  if (!ls || !rs) return

  const midX = ((ls.x + rs.x) / 2) * width
  const midY = ((ls.y + rs.y) / 2) * height
  const isSevere = absTilt >= TILT_SEVERE

  const color = isSevere ? 'rgba(220, 38, 38, 0.92)' : 'rgba(217, 119, 6, 0.88)'
  const arrowLen = isSevere ? 80 : 55

  // tiltDeg sign convention:
  //   positive = shoulders shifted RIGHT relative to hips (from camera view)
  //   → guide user to shift their weight LEFT
  //   BUT the video is mirrored (scale-x-[-1]), so canvas x is also mirrored.
  //   After mirroring, the user's right appears on the left side of the canvas.
  //   Therefore we flip: tiltDeg > 0 (user leaning right) → arrow points canvas-right (+1)
  //   so the user sees the arrow pointing toward THEIR left, which is the correction direction.
  const direction = tiltDeg > 0 ? 1 : -1
  const arrowX = midX + direction * arrowLen

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 12

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(midX, midY)
  ctx.lineTo(arrowX, midY)
  ctx.stroke()

  const headLen = 16
  ctx.beginPath()
  ctx.moveTo(arrowX, midY)
  ctx.lineTo(arrowX - direction * headLen, midY - headLen * 0.6)
  ctx.lineTo(arrowX - direction * headLen, midY + headLen * 0.6)
  ctx.closePath()
  ctx.fill()

  // Pulsing circle at origin
  ctx.globalAlpha = 0.3 + 0.3 * Math.sin(Date.now() * 0.006)
  ctx.beginPath()
  ctx.arc(midX, midY, isSevere ? 22 : 16, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  ctx.restore()
}

// ─────────────────────────────────────────────────────────────
// 垂直中線（站立品質視覺化）
// ─────────────────────────────────────────────────────────────
function drawCenterLine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  quality: 'good' | 'poor' | 'lost' | undefined,
) {
  if (!quality || quality === 'lost') return

  ctx.save()
  ctx.setLineDash([6, 8])
  ctx.lineWidth = 1.5
  ctx.strokeStyle =
    quality === 'good' ? 'rgba(47, 133, 90, 0.4)' : 'rgba(217, 119, 6, 0.4)'
  ctx.beginPath()
  ctx.moveTo(width * 0.5, height * 0.08)
  ctx.lineTo(width * 0.5, height * 0.92)
  ctx.stroke()
  ctx.restore()
}

export function PoseCanvas({
  active,
  className,
  showChrome = true,
  shoulderTiltDeg,
  trackingQuality,
  onLandmarks,
  onSnapshot,
  onError,
}: PoseCanvasProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const landmarkerRef = useRef<PoseLandmarkerLike | null>(null)
  const frameRef = useRef<number | null>(null)
  const onLandmarksRef = useRef(onLandmarks)
  const onSnapshotRef = useRef(onSnapshot)
  const shoulderTiltDegRef = useRef(shoulderTiltDeg)
  const trackingQualityRef = useRef(trackingQuality)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => { onLandmarksRef.current = onLandmarks }, [onLandmarks])
  useEffect(() => { onSnapshotRef.current = onSnapshot }, [onSnapshot])
  useEffect(() => { shoulderTiltDegRef.current = shoulderTiltDeg }, [shoulderTiltDeg])
  useEffect(() => { trackingQualityRef.current = trackingQuality }, [trackingQuality])

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null

    async function start() {
      if (!active) return
      setLoading(true)
      setReady(false)

      try {
        const video = videoRef.current
        if (!video) return

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) return

        video.srcObject = stream
        await video.play()

        const tasksVision = await import('@mediapipe/tasks-vision')
        const vision = await tasksVision.FilesetResolver.forVisionTasks(
          MEDIAPIPE_WASM_PATH,
        )
        let landmarker
        try {
          landmarker = await tasksVision.PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: POSE_MODEL_PATH,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
          })
        } catch (err) {
          console.warn('GPU initialization failed, falling back to CPU:', err)
          landmarker = await tasksVision.PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: POSE_MODEL_PATH,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
          })
        }

        landmarkerRef.current = landmarker
        setReady(true)
      } catch (error) {
        onError?.(error instanceof Error ? error.message : '無法啟動攝影機或姿態模型。')
      } finally {
        setLoading(false)
      }
    }

    start()

    return () => {
      cancelled = true
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      landmarkerRef.current?.close?.()
      landmarkerRef.current = null
      stream?.getTracks().forEach((track) => track.stop())
      setReady(false)
      setLoading(false)
    }
  }, [active, onError])

  useEffect(() => {
    if (!active || !ready) {
      // 非活動狀態清空 canvas
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx?.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    const tick = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      const landmarker = landmarkerRef.current
      if (!video || !canvas || !landmarker) return

      const width = video.videoWidth || canvas.clientWidth
      const height = video.videoHeight || canvas.clientHeight
      canvas.width = width
      canvas.height = height

      const result = landmarker.detectForVideo(video, performance.now()) as unknown as { landmarks?: LandmarkLike[][], worldLandmarks?: LandmarkLike[][] }
      const landmarks = result.landmarks?.[0]
      const worldLandmarks = result.worldLandmarks?.[0]
      const ctx = canvas.getContext('2d')

      if (ctx) {
        ctx.clearRect(0, 0, width, height)
        // 1. 中線（站立品質）
        drawCenterLine(ctx, width, height, trackingQualityRef.current)
        // 2. 骨架
        if (landmarks) drawSkeleton(ctx, landmarks, width, height)
        // 3. 引導箭頭（最上層）
        if (landmarks) drawGuidanceOverlay(ctx, landmarks, width, height, shoulderTiltDegRef.current)
      }

      const snapshot = onLandmarksRef.current(landmarks, worldLandmarks, performance.now(), width, height)
      onSnapshotRef.current(snapshot)
      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [active, ready])

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
      <video
        ref={videoRef}
        className={cn('h-full w-full scale-x-[-1] object-cover transition-opacity duration-300', active ? 'opacity-100' : 'opacity-0')}
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]" />

      {!active && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[radial-gradient(circle_at_center,rgba(45,95,93,0.34),transparent_55%)] text-white">
          <div className="rounded-full border border-white/20 bg-black/55 p-6 backdrop-blur-md">
            <Camera className="h-14 w-14" aria-hidden="true" />
          </div>
          {showChrome && (
            <p className="rounded-full border border-white/20 bg-black/55 px-6 py-3 text-center text-lg font-black backdrop-blur-md">
              開啟攝影機開始本機分析
            </p>
          )}
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 text-white">
          <Loader2 className="h-12 w-12 animate-spin" aria-hidden="true" />
          <p className="rounded-full border border-white/20 bg-black/55 px-6 py-3 text-lg font-black backdrop-blur-md">
            載入姿態模型中
          </p>
        </div>
      )}
    </div>
  )
}
