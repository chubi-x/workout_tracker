import assert from 'node:assert/strict'
import {
  ACTIVE_SESSION_KEY,
  SESSION_LOG_KEY,
  appendSession,
  elapsedMilliseconds,
  formatDuration,
  loadActiveSession,
  loadSessionLog,
  removeSession,
  saveActiveSession,
} from './storage.js'
import { exerciseProgressSeries, scaleChartPoints, workoutDurationSeries } from './progress.js'

const values = new Map()
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
}

assert.equal(elapsedMilliseconds({ elapsedMs: 2_000, startedAt: 10_000 }, 13_500), 5_500)
assert.equal(elapsedMilliseconds({ elapsedMs: 2_000, startedAt: null }, 99_000), 2_000)
assert.equal(formatDuration(65_999), '01:05')

const active = { workoutId: 'workout-a', startedAt: 10_000, exercises: { row: { sets: [] } } }
saveActiveSession(active, storage)
assert.deepEqual(loadActiveSession(storage), active)
values.set(ACTIVE_SESSION_KEY, '{bad json')
assert.equal(loadActiveSession(storage), null)

const later = { id: 'later', startedAt: '2026-08-04T11:00:00.000Z' }
const earlier = { id: 'earlier', startedAt: '2026-08-04T10:00:00.000Z' }
appendSession(later, storage)
appendSession(earlier, storage)
assert.deepEqual(loadSessionLog(storage).map(({ id }) => id), ['earlier', 'later'])
assert.ok(values.has(SESSION_LOG_KEY))
removeSession('earlier', storage)
assert.deepEqual(loadSessionLog(storage).map(({ id }) => id), ['later'])

const sessions = [
  {
    startedAt: '2026-08-01T10:00:00.000Z',
    durationSeconds: 600,
    exercises: [{ exerciseId: 'row', sets: [{ reps: 8, weightKg: 12 }, { reps: 10, weightKg: 10 }] }],
  },
  {
    startedAt: '2026-08-03T10:00:00.000Z',
    durationSeconds: 900,
    exercises: [{ exerciseId: 'row', sets: [{ reps: 12, weightKg: 14 }] }],
  },
]
assert.deepEqual(workoutDurationSeries(sessions).map(({ value }) => value), [600, 900])
assert.deepEqual(exerciseProgressSeries(sessions, 'row', 'reps').map(({ bestReps, bestWeightKg }) => [bestReps, bestWeightKg]), [[10, 12], [12, 14]])
assert.deepEqual(scaleChartPoints([10, 20]), [{ x: 5, y: 22.5 }, { x: 95, y: 5 }])

console.log('storage and timer checks passed')
