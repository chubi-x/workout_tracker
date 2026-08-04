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
assert.equal(elapsedMilliseconds({ elapsedMs: 0, startedAt: 15_000 }, 10_000), 0)
assert.equal(formatDuration(65_999), '01:05')

const active = {
  workoutId: 'workout-a',
  startedAt: 10_000,
  exercises: {
    'supported-one-arm-row': { sets: [] },
    'floor-kettlebell-pullover': { sets: [] },
    'half-kneeling-strict-press': { sets: [] },
    'bottom-up-rack-hold': { targetDuration: 20, sets: [], timer: { elapsedMs: 0, startedAt: null } },
    'kettlebell-arm-bar': { sets: [] },
    'suitcase-carry-or-march': { targetDuration: 30, sets: [], timer: { elapsedMs: 0, startedAt: null } },
  },
}
saveActiveSession(active, storage)
assert.deepEqual(loadActiveSession(storage), active)
values.set(ACTIVE_SESSION_KEY, '{bad json')
assert.equal(loadActiveSession(storage), null)
values.set(ACTIVE_SESSION_KEY, JSON.stringify({ ...active, exercises: { ...active.exercises, 'bottom-up-rack-hold': { targetDuration: 20, sets: [] } } }))
assert.equal(loadActiveSession(storage), null)
saveActiveSession(active, storage)
saveActiveSession(null, storage)
assert.equal(values.has(ACTIVE_SESSION_KEY), false)

const completedExercise = { exerciseId: 'supported-one-arm-row', sets: [{ reps: 8 }] }
const later = { id: 'later', workoutId: 'workout-a', startedAt: '2026-08-04T11:00:00.000Z', endedAt: '2026-08-04T11:10:00.000Z', durationSeconds: 600, exercises: [completedExercise] }
const earlier = { id: 'earlier', workoutId: 'workout-a', startedAt: '2026-08-04T10:00:00.000Z', endedAt: '2026-08-04T10:10:00.000Z', durationSeconds: 600, exercises: [completedExercise] }
appendSession(later, storage)
appendSession(earlier, storage)
assert.deepEqual(loadSessionLog(storage).map(({ id }) => id), ['earlier', 'later'])
assert.ok(values.has(SESSION_LOG_KEY))
removeSession('earlier', storage)
assert.deepEqual(loadSessionLog(storage).map(({ id }) => id), ['later'])
values.set(SESSION_LOG_KEY, '[{}]')
assert.deepEqual(loadSessionLog(storage), [])

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
assert.deepEqual(exerciseProgressSeries([{ ...sessions[0], exercises: [] }], 'row', 'reps'), [])
assert.deepEqual(exerciseProgressSeries([{ ...sessions[0], exercises: [{ exerciseId: 'hold', sets: [{ durationSeconds: 15 }, { durationSeconds: 25 }] }] }], 'hold', 'duration')[0].bestDuration, 25)
assert.deepEqual(scaleChartPoints([10, 20]), [{ x: 5, y: 22.5 }, { x: 95, y: 5 }])
assert.deepEqual(scaleChartPoints([0]), [{ x: 50, y: 40 }])

console.log('storage and timer checks passed')
