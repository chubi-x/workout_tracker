export function workoutDurationSeries(sessions) {
  return sessions.map((session) => ({
    date: session.startedAt,
    value: session.durationSeconds,
  }))
}

export function exerciseProgressSeries(sessions, exerciseId, mode) {
  return sessions.flatMap((session) => {
    const log = session.exercises.find((entry) => entry.exerciseId === exerciseId)
    if (!log) return []

    if (mode === 'duration') {
      return [{ date: session.startedAt, bestDuration: Math.max(...log.sets.map((set) => set.durationSeconds)) }]
    }

    const weights = log.sets.flatMap((set) => set.weightKg === undefined ? [] : [set.weightKg])
    return [{
      date: session.startedAt,
      bestReps: Math.max(...log.sets.map((set) => set.reps)),
      bestWeightKg: weights.length ? Math.max(...weights) : null,
    }]
  })
}

export function scaleChartPoints(values) {
  const maximum = Math.max(...values)
  return values.map((value, index) => ({
    x: values.length === 1 ? 50 : 5 + (index / (values.length - 1)) * 90,
    y: maximum === 0 ? 40 : 40 - (value / maximum) * 35,
  }))
}
