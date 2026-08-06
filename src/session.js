export function validRepsSet(set) {
  const reps = Number(set.reps)
  const weight = set.weightKg === '' ? null : Number(set.weightKg)
  return Number.isInteger(reps) && reps > 0 && reps <= 999 && (weight === null || (weight > 0 && weight <= 999))
}

export function validOrEmptyRepsSet(set) {
  return set.reps === '' || validRepsSet(set)
}

export function completedRepsSets(sets) {
  return sets.filter(validRepsSet)
}
