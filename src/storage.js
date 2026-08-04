export const ACTIVE_SESSION_KEY = 'work-set.active-session'
export const SESSION_LOG_KEY = 'work-set.session-log'

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

function isTimer(timer) {
  return timer && Number.isFinite(timer.elapsedMs) && (timer.startedAt === null || Number.isFinite(timer.startedAt))
}

export function loadActiveSession(storage = localStorage) {
  const session = readJson(storage, ACTIVE_SESSION_KEY)
  if (!session) return null

  const valid = typeof session.workoutId === 'string'
    && Number.isFinite(session.startedAt)
    && session.exercises && typeof session.exercises === 'object'
    && Object.values(session.exercises).every((log) => Array.isArray(log.sets) && (!log.timer || isTimer(log.timer)))

  if (valid) return session
  storage.removeItem(ACTIVE_SESSION_KEY)
  return null
}

export function saveActiveSession(session, storage = localStorage) {
  if (session) storage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session))
  else storage.removeItem(ACTIVE_SESSION_KEY)
}

export function loadSessionLog(storage = localStorage) {
  const sessions = readJson(storage, SESSION_LOG_KEY)
  return Array.isArray(sessions) ? sessions : []
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
