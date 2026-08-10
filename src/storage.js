import { exercises, workouts } from './data.js'

export const ACTIVE_SESSION_KEY = 'work-set.active-session'
export const SESSION_LOG_KEY = 'work-set.session-log'

const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
const workoutById = new Map(workouts.map((workout) => [workout.id, workout]))
const REP_MIGRATIONS = new Map([['around-the-body-pass', 10]])

export function elapsedMilliseconds(timer, now = Date.now()) {
  return timer.elapsedMs + (timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt))
}

export function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function readJson(storage, key) {
  try {
    return JSON.parse(storage.getItem(key))
  } catch {
    storage.removeItem(key)
    return null
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function migrateExerciseLog(exerciseId, log) {
  const reps = REP_MIGRATIONS.get(exerciseId)
  if (!reps || !isRecord(log) || !Array.isArray(log.sets)) return log
  const durationSets = log.sets.filter((set) => isRecord(set) && Number.isFinite(set.durationSeconds) && set.durationSeconds > 0)
  if (durationSets.length === 0) return log
  return { sets: durationSets.map(() => ({ reps })) }
}

function migrateActiveSession(session) {
  if (!isRecord(session) || !isRecord(session.exercises)) return session
  return {
    ...session,
    exercises: Object.fromEntries(Object.entries(session.exercises).map(([exerciseId, log]) => [exerciseId, migrateExerciseLog(exerciseId, log)])),
  }
}

function migrateCompletedSession(session) {
  if (!isRecord(session) || !Array.isArray(session.exercises)) return session
  return {
    ...session,
    exercises: session.exercises.map((log) => isRecord(log)
      ? { ...log, ...migrateExerciseLog(log.exerciseId, log) }
      : log),
  }
}

function isTimer(timer) {
  return isRecord(timer) && Number.isFinite(timer.elapsedMs) && timer.elapsedMs >= 0
    && (timer.startedAt === null || Number.isFinite(timer.startedAt))
}

function isEditableNumber(value) {
  return typeof value === 'string' || Number.isFinite(value)
}

function isActiveExerciseLog(log, mode) {
  if (!isRecord(log) || !Array.isArray(log.sets)) return false
  if (mode === 'duration') {
    return isTimer(log.timer) && isEditableNumber(log.targetDuration)
      && log.sets.every((set) => isRecord(set) && Number.isFinite(set.durationSeconds) && set.durationSeconds > 0)
  }
  return log.sets.every((set) => isRecord(set) && isEditableNumber(set.reps)
    && (set.weightKg === undefined || isEditableNumber(set.weightKg)))
}

function isCompletedSet(set, mode) {
  if (!isRecord(set)) return false
  if (mode === 'duration') return Number.isFinite(set.durationSeconds) && set.durationSeconds > 0
  return Number.isInteger(set.reps) && set.reps > 0
    && (set.weightKg === undefined || (Number.isFinite(set.weightKg) && set.weightKg > 0))
}

function isCompletedSession(session) {
  const workout = isRecord(session) && workoutById.get(session.workoutId)
  return isRecord(session) && typeof session.id === 'string' && typeof session.workoutId === 'string'
    && workout
    && !Number.isNaN(Date.parse(session.startedAt)) && !Number.isNaN(Date.parse(session.endedAt))
    && Number.isFinite(session.durationSeconds) && session.durationSeconds >= 0
    && Array.isArray(session.exercises) && session.exercises.length > 0
    && session.exercises.every((log) => {
      const exercise = isRecord(log) && exerciseById.get(log.exerciseId)
      return exercise && workout.exerciseIds.includes(log.exerciseId)
        && Array.isArray(log.sets) && log.sets.length > 0
        && log.sets.every((set) => isCompletedSet(set, exercise.mode))
    })
}

export function loadActiveSession(storage = localStorage) {
  const rawSession = readJson(storage, ACTIVE_SESSION_KEY)
  if (!rawSession) return null
  const session = migrateActiveSession(rawSession)

  const workout = isRecord(session) && workoutById.get(session.workoutId)
  const valid = workout
    && Number.isFinite(session.startedAt)
    && isRecord(session.exercises)
    && Object.keys(session.exercises).length === workout.exerciseIds.length
    && workout.exerciseIds.every((id) => isActiveExerciseLog(session.exercises[id], exerciseById.get(id).mode))

  if (valid) {
    if (JSON.stringify(session) !== JSON.stringify(rawSession)) saveActiveSession(session, storage)
    return session
  }
  storage.removeItem(ACTIVE_SESSION_KEY)
  return null
}

export function saveActiveSession(session, storage = localStorage) {
  if (session) storage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session))
  else storage.removeItem(ACTIVE_SESSION_KEY)
}

export function loadSessionLog(storage = localStorage) {
  const rawSessions = readJson(storage, SESSION_LOG_KEY)
  if (!Array.isArray(rawSessions)) {
    storage.removeItem(SESSION_LOG_KEY)
    return []
  }
  const sessions = rawSessions.map(migrateCompletedSession)
  if (sessions.every(isCompletedSession)) {
    if (JSON.stringify(sessions) !== JSON.stringify(rawSessions)) storage.setItem(SESSION_LOG_KEY, JSON.stringify(sessions))
    return sessions
  }
  storage.removeItem(SESSION_LOG_KEY)
  return []
}

export function appendSession(session, storage = localStorage) {
  const sessions = [...loadSessionLog(storage), session]
    .sort((first, second) => Date.parse(first.startedAt) - Date.parse(second.startedAt))
  storage.setItem(SESSION_LOG_KEY, JSON.stringify(sessions))
  return sessions
}

export function removeSession(id, storage = localStorage) {
  const sessions = loadSessionLog(storage).filter((session) => session.id !== id)
  storage.setItem(SESSION_LOG_KEY, JSON.stringify(sessions))
  return sessions
}
