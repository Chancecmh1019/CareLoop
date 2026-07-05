import { evaluateSession, MOTION_THRESHOLDS } from '@/lib/decision-engine'
import type {
  EnvironmentQuality,
  FrameMetric,
  LandmarkLike,
  CoachAction,
  MotionSnapshot,
  MotionState,
  SessionEvent,
  TrackingQuality,
} from '@/lib/types'

const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12
const LEFT_HIP = 23
const RIGHT_HIP = 24
const LEFT_KNEE = 25
const RIGHT_KNEE = 26

// ─── EMA smoother ───────────────────────────────────────────────
// Reduces frame-to-frame jitter without adding lag
class EMAFilter {
  private alpha: number
  private value: number | null = null
  constructor(alpha = 0.25) { this.alpha = alpha }
  update(raw: number): number {
    if (this.value === null) { this.value = raw; return raw }
    this.value = this.alpha * raw + (1 - this.alpha) * this.value
    return this.value
  }
  reset() { this.value = null }
  get current() { return this.value }
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function visibilityOf(point?: LandmarkLike) {
  return typeof point?.visibility === 'number' ? point.visibility : 0.8
}

function classifyTracking(visibilityAvg: number): TrackingQuality {
  if (visibilityAvg < 0.25) return 'lost'
  if (visibilityAvg < MOTION_THRESHOLDS.MIN_VISIBILITY_AVG) return 'poor'
  return 'good'
}

/**
 * 計算軀幹側向偏移角度（有符號，供箭頭方向使用）
 *
 * 方法：midShoulder → midHip 的水平位移比例轉換為角度
 * 正值 = 重心偏右（從鏡頭視角），負值 = 偏左
 *
 * 這比「肩線水平傾角」更能代表使用者真正的身體偏斜，
 * 因為肩線傾角在正常坐站時本來就不為零。
 */
function calcTrunkLateralDeg(
  ls: LandmarkLike, rs: LandmarkLike,
  lh: LandmarkLike, rh: LandmarkLike,
  videoWidth: number, videoHeight: number
): number {
  const midShoulderX = (ls.x + rs.x) / 2
  const midHipX = (lh.x + rh.x) / 2
  const midShoulderY = (ls.y + rs.y) / 2
  const midHipY = (lh.y + rh.y) / 2

  // Convert normalized coordinates to aspect-ratio-corrected space
  // This ensures angles are consistent whether on a portrait phone or landscape laptop
  const dx = (midShoulderX - midHipX) * videoWidth   // positive = shoulders shifted right vs hips
  const dy = Math.abs(midHipY - midShoulderY) * videoHeight // vertical distance (always positive)

  // Calculate shoulder width as a reference scale (independent of depth)
  const shoulderWidth = Math.abs(rs.x - ls.x) * videoWidth

  // MediaPipe 2D projection problem: 
  // When a person leans forward (flexion), the Y-distance (dy) between shoulders and hips shrinks in 2D.
  // This causes the atan2(dx, dy) to explode, artificially creating huge lateral tilt angles.
  // To fix this, we suppress the angle calculation if dy is too small relative to their shoulder width,
  // which indicates they are bent over (transitioning) and 2D lateral tilt is unreliable.
  if (dy < shoulderWidth * 0.8) {
    return 0 // Highly flexed forward; lateral tilt is mathematically distorted
  }

  return Math.atan2(dx, dy) * (180 / Math.PI)
}

export function checkEnvironment(landmarks: LandmarkLike[] | undefined, videoWidth: number, videoHeight: number): EnvironmentQuality {
  if (!landmarks || landmarks.length === 0) {
    return { lighting: 'poor', distance: 'good', angle: 'good', ready: false, personMissing: true }
  }

  const visibilityAvg = average([
    visibilityOf(landmarks[LEFT_SHOULDER]),
    visibilityOf(landmarks[RIGHT_SHOULDER]),
    visibilityOf(landmarks[LEFT_HIP]),
    visibilityOf(landmarks[RIGHT_HIP]),
  ])

  const hipY = average([landmarks[LEFT_HIP].y, landmarks[RIGHT_HIP].y])

  // Calculate shoulder width as a proxy for distance
  // Use aspect-ratio-corrected distance for cross-device consistency
  const dx = (landmarks[RIGHT_SHOULDER].x - landmarks[LEFT_SHOULDER].x) * videoWidth
  const dy = (landmarks[RIGHT_SHOULDER].y - landmarks[LEFT_SHOULDER].y) * videoHeight
  const shoulderWidthPx = Math.sqrt(dx * dx + dy * dy)
  // Express as a proportion of the smaller dimension (usually width on mobile, height on desktop)
  const minDimension = Math.min(videoWidth, videoHeight)
  const shoulderWidth = minDimension > 0 ? shoulderWidthPx / minDimension : 0

  const lighting = visibilityAvg > 0.7 ? 'good' : 'poor'
  const distance = shoulderWidth > 0.35 ? 'tooClose' : shoulderWidth < 0.08 ? 'tooFar' : 'good'
  const angle = hipY < 0.3 ? 'tooHigh' : hipY > 0.9 ? 'tooLow' : 'good'

  return {
    lighting,
    distance,
    angle,
    ready: lighting === 'good' && distance === 'good' && angle === 'good',
    personMissing: false,
  }
}

export function createMotionAnalyzer() {
  let seatedHipY: number | null = null
  let seatedLegExtension: number | null = null
  let previousHipX: number | null = null
  let previousState: MotionState = 'unknown'
  let stateSince = 0
  let sawStanding = false
  let lowestHipYDuringStand: number | null = null
  let seatedCandidateCount = 0
  let reps = 0
  let startedAtMs: number | null = null
  let completedAtMs: number | null = null
  // tiltMaxDeg stores the maximum ABSOLUTE tilt seen (for summary statistics)
  let tiltMaxDeg = 0
  // tiltSignedDeg stores the signed value of the LATEST frame (for arrow direction)
  let tiltSignedDeg = 0
  let instabilityEvents = 0
  let latestMetric: FrameMetric | null = null
  let trackingQuality: TrackingQuality = 'lost'
  // Coaching pace: track WHEN we last confirmed standing/sitting so we can
  // add a pause before issuing the next coaching prompt.
  let standingConfirmedAtMs: number | null = null
  let sittingConfirmedAtMs: number | null = null
  let latestTimestampMs = 0

  // ── Calibration: require the user to be stable for N frames ──────
  // We lower the threshold to 0.20 (very permissive) but add a stability
  // check and an auto-correction mechanism later to handle if they
  // calibrate while standing.
  const CALIBRATION_FRAMES = 10   // ~0.33 s at 30 fps
  const CALIBRATION_SIT_THRESHOLD = 0.20
  let sittingFrameCount = 0
  let calibrationHipYSum = 0
  let calibrationLegExtensionSum = 0
  let lowerBaselineCount = 0
  let previousHipYForStability: number | null = null

  // EMA smoothers — reduce landmark jitter without introducing lag
  const hipYFilter = new EMAFilter(0.25)
  const hipXFilter = new EMAFilter(0.25)
  const legExtensionFilter = new EMAFilter(0.25)
  const tiltFilter = new EMAFilter(0.20)   // slightly more smoothing for tilt angle

  function reset() {
    seatedHipY = null
    seatedLegExtension = null
    previousHipX = null
    previousState = 'unknown'
    stateSince = 0
    sawStanding = false
    lowestHipYDuringStand = null
    seatedCandidateCount = 0
    reps = 0
    startedAtMs = null
    completedAtMs = null
    tiltMaxDeg = 0
    tiltSignedDeg = 0
    instabilityEvents = 0
    latestMetric = null
    trackingQuality = 'lost'
    sittingFrameCount = 0
    calibrationHipYSum = 0
    calibrationLegExtensionSum = 0
    lowerBaselineCount = 0
    previousHipYForStability = null
    standingConfirmedAtMs = null
    sittingConfirmedAtMs = null
    latestTimestampMs = 0
    hipYFilter.reset()
    hipXFilter.reset()
    legExtensionFilter.reset()
    tiltFilter.reset()
  }

  function getSnapshot(): MotionSnapshot {
    const end = completedAtMs ?? latestMetric?.timestampMs ?? startedAtMs ?? 0
    const totalDurationSec = startedAtMs ? Math.max(0, (end - startedAtMs) / 1000) : 0
    const now = latestTimestampMs
    // Coaching pace: don't immediately prompt the next action.
    // After standing, wait STAND_PAUSE_MS before prompting "sit".
    // After sitting, wait SIT_PAUSE_MS before prompting "stand".
    const standPauseElapsed = standingConfirmedAtMs !== null
      ? now - standingConfirmedAtMs >= MOTION_THRESHOLDS.STAND_PAUSE_MS
      : false
    const sitPauseElapsed = sittingConfirmedAtMs !== null
      ? now - sittingConfirmedAtMs >= MOTION_THRESHOLDS.SIT_PAUSE_MS
      : true  // initially ready immediately

    const nextAction: CoachAction =
      reps >= MOTION_THRESHOLDS.TARGET_REPS
        ? 'complete'
        : seatedHipY === null
          ? 'hold'
          : sawStanding
            ? (standPauseElapsed ? 'sit' : 'hold')   // wait for full stand before cueing sit
            : (sitPauseElapsed  ? 'stand' : 'hold')  // rest between reps
    return {
      reps,
      nextAction,
      totalDurationSec,
      avgDurationSec: reps > 0 ? totalDurationSec / reps : 0,
      tiltMaxDeg,
      tiltSignedDeg,
      instabilityEvents,
      trackingQuality,
      latestMetric,
      complete: reps >= MOTION_THRESHOLDS.TARGET_REPS,
    }
  }

  function processFrame(landmarks: LandmarkLike[] | undefined, timestampMs: number, videoWidth: number, videoHeight: number): MotionSnapshot {
    if (!landmarks || landmarks.length === 0) {
      latestMetric = {
        timestampMs,
        hipY: null,
        hipX: null,
        shoulderTiltDeg: null,
        visibilityAvg: 0,
        motionState: 'unknown',
      }
      trackingQuality = 'lost'
      return getSnapshot()
    }

    const points = [
      landmarks[LEFT_SHOULDER],
      landmarks[RIGHT_SHOULDER],
      landmarks[LEFT_HIP],
      landmarks[RIGHT_HIP],
      landmarks[LEFT_KNEE],
      landmarks[RIGHT_KNEE],
    ]
    const visibilityAvg = average(points.map(visibilityOf))
    trackingQuality = classifyTracking(visibilityAvg)

    const leftHip = landmarks[LEFT_HIP]
    const rightHip = landmarks[RIGHT_HIP]
    const leftShoulder = landmarks[LEFT_SHOULDER]
    const rightShoulder = landmarks[RIGHT_SHOULDER]

    const rawHipY = leftHip && rightHip ? average([leftHip.y, rightHip.y]) : null
    const rawHipX = leftHip && rightHip ? average([leftHip.x, rightHip.x]) : null
    const leftKnee = landmarks[LEFT_KNEE]
    const rightKnee = landmarks[RIGHT_KNEE]
    const rawKneeY = leftKnee && rightKnee ? average([leftKnee.y, rightKnee.y]) : null
    const rawLegExtension = rawHipY !== null && rawKneeY !== null ? rawKneeY - rawHipY : null

    // Apply EMA smoothing to reduce jitter
    const hipY = rawHipY !== null ? hipYFilter.update(rawHipY) : null
    const hipX = rawHipX !== null ? hipXFilter.update(rawHipX) : null
    const legExtension = rawLegExtension !== null ? legExtensionFilter.update(rawLegExtension) : null

    // ── Tilt angle: trunk lateral deviation (SIGNED) ──────────────
    // Uses midShoulder vs midHip horizontal offset instead of
    // shoulder-line angle, which varies naturally during sit-to-stand.
    let rawTilt: number | null = null
    if (leftShoulder && rightShoulder && leftHip && rightHip) {
      rawTilt = calcTrunkLateralDeg(leftShoulder, rightShoulder, leftHip, rightHip, videoWidth, videoHeight)
    }
    const smoothedTilt = rawTilt !== null ? tiltFilter.update(rawTilt) : null

    if (smoothedTilt !== null) {
      tiltSignedDeg = smoothedTilt
      // Track absolute max for session summary statistics
      tiltMaxDeg = Math.max(tiltMaxDeg, Math.abs(smoothedTilt))
    }

    let motionState: MotionState = 'unknown'
    if (trackingQuality === 'lost' || hipY === null) {
      motionState = 'unknown'
    } else {
      if (seatedHipY === null) {
        // ── Calibration phase ─────────────────────────────────────
        // Require hipY to be generally in frame (>0.20) and stable
        const currentAvg = sittingFrameCount > 0 ? calibrationHipYSum / sittingFrameCount : hipY
        if (hipY > CALIBRATION_SIT_THRESHOLD && Math.abs(hipY - currentAvg) < 0.03) {
          sittingFrameCount++
          calibrationHipYSum += hipY
          calibrationLegExtensionSum += legExtension ?? 0
          if (sittingFrameCount >= CALIBRATION_FRAMES) {
            seatedHipY = calibrationHipYSum / sittingFrameCount
            seatedLegExtension = calibrationLegExtensionSum / sittingFrameCount
          }
        } else {
          sittingFrameCount = 1
          calibrationHipYSum = hipY
          calibrationLegExtensionSum = legExtension ?? 0
        }
        motionState = 'unknown'   // still calibrating
      } else {
        // ── Normal detection phase ────────────────────────────────
        const hipRiseFromSeat = seatedHipY - hipY
        const legExtensionRise =
          seatedLegExtension !== null && legExtension !== null
            ? legExtension - seatedLegExtension
            : 0
        const standingByHip = hipRiseFromSeat >= MOTION_THRESHOLDS.STAND_DELTA_Y
        const standingByLeg = legExtensionRise >= MOTION_THRESHOLDS.LEG_EXTENSION_DELTA_Y
        const seatedByHip = sawStanding
          ? hipY >= seatedHipY - MOTION_THRESHOLDS.SITTING_TOLERANCE_Y
          : Math.abs(hipY - seatedHipY) <= MOTION_THRESHOLDS.SITTING_TOLERANCE_Y
        const seatedByLeg =
          seatedLegExtension !== null &&
          legExtension !== null &&
          legExtension <= seatedLegExtension + MOTION_THRESHOLDS.LEG_EXTENSION_SITTING_TOLERANCE_Y

        if (standingByHip || standingByLeg) {
          motionState = 'standing'
          lowestHipYDuringStand = lowestHipYDuringStand === null ? hipY : Math.min(lowestHipYDuringStand, hipY)
          seatedCandidateCount = 0
          lowerBaselineCount = 0
        } else if (seatedByHip || seatedByLeg) {
          motionState = 'sitting'
          seatedCandidateCount += 1
          lowerBaselineCount = 0
        } else {
          motionState = 'moving'
          if (
            sawStanding &&
            lowestHipYDuringStand !== null &&
            hipY - lowestHipYDuringStand >= MOTION_THRESHOLDS.STAND_DELTA_Y * 0.65
          ) {
            seatedCandidateCount += 1
            if (seatedCandidateCount >= 6) motionState = 'sitting'
          } else {
            seatedCandidateCount = 0
          }
          // Auto-correct seated baseline downwards!
          // If they calibrated while standing, their seated position will be much lower (larger Y).
          if (hipY > seatedHipY + MOTION_THRESHOLDS.SITTING_TOLERANCE_Y) {
            if (previousHipYForStability !== null && Math.abs(hipY - previousHipYForStability) < 0.015) {
              lowerBaselineCount++
              if (lowerBaselineCount > 10) {
                // They have been stable at a significantly lower position for 10 frames.
                // This is the true seated baseline.
                seatedHipY = hipY
                if (legExtension !== null) seatedLegExtension = legExtension
                lowerBaselineCount = 0
              }
            } else {
              lowerBaselineCount = 0
            }
          } else {
            lowerBaselineCount = 0
          }
        }
      }
    }

    previousHipYForStability = hipY

    // ── Instability detection: hipX lateral jump ──────────────────
    if (hipX !== null && previousHipX !== null && Math.abs(hipX - previousHipX) > MOTION_THRESHOLDS.INSTABILITY_X_JUMP) {
      instabilityEvents += 1
    }
    if (hipX !== null) previousHipX = hipX

    // ── State machine ─────────────────────────────────────────────
    if (motionState !== previousState) {
      previousState = motionState
      stateSince = timestampMs
    }

    const stateHeld = timestampMs - stateSince >= MOTION_THRESHOLDS.MIN_STATE_HOLD_MS
    if (stateHeld && reps < MOTION_THRESHOLDS.TARGET_REPS) {
      if (motionState === 'standing') {
        if (!sawStanding) {
          // First frame we've been stably standing — record for pace timing
          standingConfirmedAtMs = timestampMs
        }
        sawStanding = true
        if (startedAtMs === null) startedAtMs = timestampMs
      }

      if (motionState === 'sitting' && sawStanding) {
        reps += 1
        sawStanding = false
        lowestHipYDuringStand = null
        seatedCandidateCount = 0
        // Re-calibrate seated baseline after each rep (accounts for micro-shifts in posture)
        if (hipY !== null && seatedHipY !== null) {
          seatedHipY = hipY >= seatedHipY
            ? seatedHipY * 0.65 + hipY * 0.35
            : seatedHipY
        }
        if (legExtension !== null && seatedLegExtension !== null) {
          seatedLegExtension = legExtension <= seatedLegExtension + MOTION_THRESHOLDS.LEG_EXTENSION_SITTING_TOLERANCE_Y
            ? seatedLegExtension * 0.7 + legExtension * 0.3
            : seatedLegExtension
        }
        if (reps >= MOTION_THRESHOLDS.TARGET_REPS) completedAtMs = timestampMs
        // Record when we settled back to sitting for rest-between-reps pacing
        sittingConfirmedAtMs = timestampMs
        standingConfirmedAtMs = null
      }
    }

    latestTimestampMs = timestampMs
    latestMetric = {
      timestampMs,
      hipY,
      hipX,
      // Store the SIGNED value so PoseCanvas can determine arrow direction
      shoulderTiltDeg: smoothedTilt,
      visibilityAvg,
      motionState,
    }

    return getSnapshot()
  }

  function createSession(): SessionEvent {
    const snapshot = getSnapshot()
    const decision = evaluateSession(snapshot)
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      reps: snapshot.reps,
      totalDurationSec: Number(snapshot.totalDurationSec.toFixed(1)),
      avgDurationSec: Number(snapshot.avgDurationSec.toFixed(1)),
      tiltMaxDeg: Number(snapshot.tiltMaxDeg.toFixed(0)),
      instabilityEvents: snapshot.instabilityEvents,
      level: decision.level,
      trackingQuality: snapshot.trackingQuality,
      notes: decision.notes,
    }
  }

  return {
    processFrame,
    getSnapshot,
    createSession,
    reset,
  }
}
