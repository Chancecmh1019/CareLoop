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
const LEFT_ANKLE = 27
const RIGHT_ANKLE = 28
const NOSE = 0

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
  if (!point) return 0
  return typeof point?.visibility === 'number' ? point.visibility : 0.8
}

function classifyTracking(visibilityAvg: number): TrackingQuality {
  if (visibilityAvg < 0.25) return 'lost'
  if (visibilityAvg < MOTION_THRESHOLDS.MIN_VISIBILITY_AVG) return 'poor'
  return 'good'
}

/**
/**
 * 計算軀幹側向偏移角度（有符號，供箭頭方向使用）
 * 完全免疫 2D 投影誤差（無視攝影機 Yaw/Pitch 與人體前傾）
 * 使用 3D worldLandmarks 幾何計算
 */
function calcTrunkLateralDeg3D(
  ls: LandmarkLike, rs: LandmarkLike,
  lh: LandmarkLike, rh: LandmarkLike
): number {
  if (lh.z === undefined) return 0 // Fallback

  // 1. Hip line vector (Right Hip to Left Hip - defines local X axis)
  // Note: user's right hip is usually smaller X on screen, but worldLandmarks X is metric.
  const H = {
    x: lh.x - rh.x,
    y: lh.y - rh.y,
    z: (lh.z || 0) - (rh.z || 0)
  }

  // 2. Trunk vector (Mid Hip to Mid Shoulder)
  const midHip = {
    x: (lh.x + rh.x) / 2,
    y: (lh.y + rh.y) / 2,
    z: ((lh.z || 0) + (rh.z || 0)) / 2
  }
  const midShoulder = {
    x: (ls.x + rs.x) / 2,
    y: (ls.y + rs.y) / 2,
    z: ((ls.z || 0) + (rs.z || 0)) / 2
  }
  const T = {
    x: midShoulder.x - midHip.x,
    y: midShoulder.y - midHip.y,
    z: midShoulder.z - midHip.z
  }

  // 3. Calculate 3D angle between H (Hip line) and T (Trunk)
  const dot = H.x * T.x + H.y * T.y + H.z * T.z
  const magH = Math.sqrt(H.x * H.x + H.y * H.y + H.z * H.z)
  const magT = Math.sqrt(T.x * T.x + T.y * T.y + T.z * T.z)

  if (magH === 0 || magT === 0) return 0

  const cosTheta = dot / (magH * magT)
  const angleRad = Math.acos(Math.max(-1, Math.min(1, cosTheta)))
  const angleDeg = angleRad * (180 / Math.PI)

  // 4. Lateral lean is deviation from 90 degrees
  // If T is perpendicular to H in 3D space, they are standing/sitting straight up OR leaning perfectly forward.
  // Both cases give exactly 90 degrees (invariant to pitch and yaw).
  // H points from right to left hip. 
  // If they lean towards their right hip, the angle increases > 90.
  // If they lean towards their left hip, the angle decreases < 90.
  return angleDeg - 90
}

function calcJointAngleDeg(a: LandmarkLike | undefined, b: LandmarkLike | undefined, c: LandmarkLike | undefined): number | null {
  if (!a || !b || !c) return null

  const ab = {
    x: a.x - b.x,
    y: a.y - b.y,
    z: (a.z ?? 0) - (b.z ?? 0),
  }
  const cb = {
    x: c.x - b.x,
    y: c.y - b.y,
    z: (c.z ?? 0) - (b.z ?? 0),
  }
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z
  const magAb = Math.sqrt(ab.x * ab.x + ab.y * ab.y + ab.z * ab.z)
  const magCb = Math.sqrt(cb.x * cb.x + cb.y * cb.y + cb.z * cb.z)
  if (magAb === 0 || magCb === 0) return null

  const cosTheta = dot / (magAb * magCb)
  return Math.acos(Math.max(-1, Math.min(1, cosTheta))) * (180 / Math.PI)
}

function averageKneeAngle(landmarks: LandmarkLike[] | undefined): number | null {
  if (!landmarks) return null
  const left = calcJointAngleDeg(landmarks[LEFT_HIP], landmarks[LEFT_KNEE], landmarks[LEFT_ANKLE])
  const right = calcJointAngleDeg(landmarks[RIGHT_HIP], landmarks[RIGHT_KNEE], landmarks[RIGHT_ANKLE])
  const values = [left, right].filter((value): value is number => value !== null && Number.isFinite(value))
  return values.length > 0 ? average(values) : null
}

export function checkEnvironment(landmarks: LandmarkLike[] | undefined, videoWidth: number, videoHeight: number): EnvironmentQuality {
  if (!landmarks || landmarks.length === 0) {
    return { lighting: 'poor', distance: 'good', angle: 'good', ready: false, personMissing: true, bodyIncomplete: true }
  }

  const requiredLandmarks = [
    landmarks[NOSE],
    landmarks[LEFT_SHOULDER],
    landmarks[RIGHT_SHOULDER],
    landmarks[LEFT_HIP],
    landmarks[RIGHT_HIP],
    landmarks[LEFT_KNEE],
    landmarks[RIGHT_KNEE],
    landmarks[LEFT_ANKLE],
    landmarks[RIGHT_ANKLE],
  ]

  const visibilityAvg = average(requiredLandmarks.map(visibilityOf))
  const bodyIncomplete = requiredLandmarks.some((point) => visibilityOf(point) < 0.35)

  const hipY = average([landmarks[LEFT_HIP].y, landmarks[RIGHT_HIP].y])

  // Calculate shoulder width as a proxy for distance
  // Use aspect-ratio-corrected distance for cross-device consistency
  const dx = (landmarks[RIGHT_SHOULDER].x - landmarks[LEFT_SHOULDER].x) * videoWidth
  const dy = (landmarks[RIGHT_SHOULDER].y - landmarks[LEFT_SHOULDER].y) * videoHeight
  const shoulderWidthPx = Math.sqrt(dx * dx + dy * dy)
  // Express as a proportion of the smaller dimension (usually width on mobile, height on desktop)
  const minDimension = Math.min(videoWidth, videoHeight)
  const shoulderWidth = minDimension > 0 ? shoulderWidthPx / minDimension : 0
  const visiblePoints = requiredLandmarks.filter((point): point is LandmarkLike => Boolean(point))
  const minY = Math.min(...visiblePoints.map((point) => point.y))
  const maxY = Math.max(...visiblePoints.map((point) => point.y))
  const bodyHeight = maxY - minY

  const lighting = visibilityAvg > 0.7 ? 'good' : 'poor'
  const distance = shoulderWidth > 0.35 || bodyHeight > 0.94
    ? 'tooClose'
    : shoulderWidth < 0.055 || bodyHeight < 0.42
      ? 'tooFar'
      : 'good'
  const angle = minY < 0.02 ? 'tooHigh' : hipY > 0.9 || maxY > 0.98 ? 'tooLow' : 'good'

  return {
    lighting,
    distance,
    angle,
    ready: lighting === 'good' && distance === 'good' && angle === 'good' && !bodyIncomplete,
    personMissing: false,
    bodyIncomplete,
  }
}

export function createMotionAnalyzer() {
  let seatedHipY: number | null = null
  let seatedLegExtension: number | null = null
  let seatedKneeAngle: number | null = null
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
  let neutralTiltDeg: number | null = null
  let neutralTiltSampleCount = 0
  let neutralTiltSum = 0
  let tiltSpikeCandidateDeg = 0
  let tiltSpikeCandidateFrames = 0
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
  const MIN_TILT_BASELINE_FRAMES = 5
  const TILT_DEADBAND_DEG = 1.5
  const TILT_SINGLE_FRAME_SPIKE_DEG = 10
  const TILT_SPIKE_CONFIRM_FRAMES = 3
  let sittingFrameCount = 0
  let calibrationHipYSum = 0
  let calibrationLegExtensionSum = 0
  let calibrationKneeAngleSum = 0
  let calibrationKneeAngleCount = 0
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
    seatedKneeAngle = null
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
    neutralTiltDeg = null
    neutralTiltSampleCount = 0
    neutralTiltSum = 0
    tiltSpikeCandidateDeg = 0
    tiltSpikeCandidateFrames = 0
    instabilityEvents = 0
    latestMetric = null
    trackingQuality = 'lost'
    sittingFrameCount = 0
    calibrationHipYSum = 0
    calibrationLegExtensionSum = 0
    calibrationKneeAngleSum = 0
    calibrationKneeAngleCount = 0
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

  function resetTiltSpikeCandidate() {
    tiltSpikeCandidateDeg = 0
    tiltSpikeCandidateFrames = 0
  }

  function trackTiltMax(correctedTiltDeg: number) {
    const absTilt = Math.abs(correctedTiltDeg)
    if (absTilt <= tiltMaxDeg) {
      resetTiltSpikeCandidate()
      return
    }

    const jump = absTilt - tiltMaxDeg
    if (jump <= TILT_SINGLE_FRAME_SPIKE_DEG) {
      tiltMaxDeg = absTilt
      resetTiltSpikeCandidate()
      return
    }

    if (Math.abs(absTilt - tiltSpikeCandidateDeg) <= 4) {
      tiltSpikeCandidateFrames += 1
    } else {
      tiltSpikeCandidateDeg = absTilt
      tiltSpikeCandidateFrames = 1
    }

    if (tiltSpikeCandidateFrames >= TILT_SPIKE_CONFIRM_FRAMES) {
      tiltMaxDeg = tiltSpikeCandidateDeg
      resetTiltSpikeCandidate()
    }
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

  function processFrame(landmarks: LandmarkLike[] | undefined, worldLandmarks: LandmarkLike[] | undefined, timestampMs: number, videoWidth: number, videoHeight: number): MotionSnapshot {
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
      landmarks[LEFT_ANKLE],
      landmarks[RIGHT_ANKLE],
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
    const rawKneeAngle = averageKneeAngle(worldLandmarks) ?? averageKneeAngle(landmarks)

    // Apply EMA smoothing to reduce jitter
    const hipY = rawHipY !== null ? hipYFilter.update(rawHipY) : null
    const hipX = rawHipX !== null ? hipXFilter.update(rawHipX) : null
    const legExtension = rawLegExtension !== null ? legExtensionFilter.update(rawLegExtension) : null

    // ── Tilt angle: trunk lateral deviation (SIGNED) ──────────────
    // Uses 3D world landmarks to completely eliminate yaw and pitch projection errors.
    let rawTilt: number | null = null
    if (worldLandmarks && worldLandmarks.length > RIGHT_HIP) {
      rawTilt = calcTrunkLateralDeg3D(
        worldLandmarks[LEFT_SHOULDER], worldLandmarks[RIGHT_SHOULDER],
        worldLandmarks[LEFT_HIP], worldLandmarks[RIGHT_HIP]
      )
    } else if (leftShoulder && rightShoulder && leftHip && rightHip) {
      // Fallback to 2D approximation if worldLandmarks missing (rare)
      const Tx = (leftShoulder.x + rightShoulder.x) / 2 - (leftHip.x + rightHip.x) / 2
      const Ty = (leftShoulder.y + rightShoulder.y) / 2 - (leftHip.y + rightHip.y) / 2
      rawTilt = Math.atan2(Tx * videoWidth, Math.abs(Ty) * videoHeight) * (180 / Math.PI)
      if (Math.abs(Ty) * videoHeight < Math.abs(leftShoulder.x - rightShoulder.x) * videoWidth * 0.8) {
        rawTilt = 0 // Apply the old 2D flexion suppression as fallback
      }
    }
    const smoothedTilt = rawTilt !== null ? tiltFilter.update(rawTilt) : null
    let correctedTilt: number | null = null

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
          if (rawKneeAngle !== null) {
            calibrationKneeAngleSum += rawKneeAngle
            calibrationKneeAngleCount += 1
          }
          if (smoothedTilt !== null && trackingQuality === 'good' && Math.abs(smoothedTilt) <= 45) {
            neutralTiltSampleCount += 1
            neutralTiltSum += smoothedTilt
          }
          if (sittingFrameCount >= CALIBRATION_FRAMES) {
            seatedHipY = calibrationHipYSum / sittingFrameCount
            seatedLegExtension = calibrationLegExtensionSum / sittingFrameCount
            seatedKneeAngle = calibrationKneeAngleCount > 0
              ? calibrationKneeAngleSum / calibrationKneeAngleCount
              : null
            neutralTiltDeg =
              neutralTiltSampleCount >= MIN_TILT_BASELINE_FRAMES
                ? neutralTiltSum / neutralTiltSampleCount
                : smoothedTilt ?? 0
          }
        } else {
          sittingFrameCount = 1
          calibrationHipYSum = hipY
          calibrationLegExtensionSum = legExtension ?? 0
          calibrationKneeAngleSum = rawKneeAngle ?? 0
          calibrationKneeAngleCount = rawKneeAngle !== null ? 1 : 0
          neutralTiltSampleCount = smoothedTilt !== null && trackingQuality === 'good' ? 1 : 0
          neutralTiltSum = smoothedTilt !== null && trackingQuality === 'good' ? smoothedTilt : 0
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
        const standingByKnee =
          rawKneeAngle !== null &&
          (
            rawKneeAngle >= 160 ||
            (seatedKneeAngle !== null && rawKneeAngle - seatedKneeAngle >= 35)
          )
        const seatedByHip = sawStanding
          ? hipY >= seatedHipY - MOTION_THRESHOLDS.SITTING_TOLERANCE_Y
          : Math.abs(hipY - seatedHipY) <= MOTION_THRESHOLDS.SITTING_TOLERANCE_Y
        const seatedByLeg =
          seatedLegExtension !== null &&
          legExtension !== null &&
          legExtension <= seatedLegExtension + MOTION_THRESHOLDS.LEG_EXTENSION_SITTING_TOLERANCE_Y
        const seatedByKnee =
          rawKneeAngle !== null &&
          seatedKneeAngle !== null &&
          rawKneeAngle <= seatedKneeAngle + 18

        if (standingByHip || standingByLeg || standingByKnee) {
          motionState = 'standing'
          lowestHipYDuringStand = lowestHipYDuringStand === null ? hipY : Math.min(lowestHipYDuringStand, hipY)
          seatedCandidateCount = 0
          lowerBaselineCount = 0
        } else if (seatedByHip || seatedByLeg || seatedByKnee) {
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

    if (smoothedTilt !== null && neutralTiltDeg !== null) {
      const rawCorrectedTilt = smoothedTilt - neutralTiltDeg
      correctedTilt = Math.abs(rawCorrectedTilt) < TILT_DEADBAND_DEG ? 0 : rawCorrectedTilt
      tiltSignedDeg = correctedTilt
    }

    // ── Instability detection: hipX lateral jump ──────────────────
    if (hipX !== null && previousHipX !== null && Math.abs(hipX - previousHipX) > MOTION_THRESHOLDS.INSTABILITY_X_JUMP) {
      // Only count instability if we are actually tracking a known state
      if (motionState !== 'unknown') {
        instabilityEvents += 1
      }
    }
    if (hipX !== null) previousHipX = hipX

    // ── Track tiltMaxDeg ONLY during valid test phases ────────────
    // Exclude 'unknown' (calibration/walking in) to prevent noisy spikes from ruining the session max.
    if (motionState !== 'unknown' && trackingQuality !== 'lost' && correctedTilt !== null) {
      trackTiltMax(correctedTilt)
    }

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
        if (rawKneeAngle !== null && seatedKneeAngle !== null && rawKneeAngle <= seatedKneeAngle + 20) {
          seatedKneeAngle = seatedKneeAngle * 0.7 + rawKneeAngle * 0.3
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
      shoulderTiltDeg: correctedTilt,
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
