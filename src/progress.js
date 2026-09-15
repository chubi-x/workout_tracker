export function workoutDurationSeries(sessions) {
  return sessions.map((session) => ({
    date: session.startedAt,
    value: session.durationSeconds,
  }))
}

export function workoutVolumeSeries(sessions, regularExerciseIds) {
  const regularIds = new Set(regularExerciseIds)
  return sessions.map((session) => ({
    date: session.startedAt,
    value: session.exercises.reduce((sessionVolume, log) => {
      if (!regularIds.has(log.exerciseId)) return sessionVolume
      const exerciseVolume = log.sets.reduce((total, set) => (
        total + (Number.isFinite(set.reps) ? set.reps : 0)
      ), 0)
      return sessionVolume + exerciseVolume
    }, 0),
  }))
}

export function exerciseProgressSeries(sessions, exerciseId, mode) {
  return sessions.flatMap((session) => {
    const log = session.exercises.find((entry) => entry.exerciseId === exerciseId)
    if (!log) return []

    if (mode === 'duration') {
      return [{ date: session.startedAt, bestDuration: Math.max(...log.sets.map((set) => set.durationSeconds)) }]
    }

    return [{
      date: session.startedAt,
      totalReps: log.sets.reduce((total, set) => total + set.reps, 0),
      setCount: log.sets.length,
    }]
  })
}
