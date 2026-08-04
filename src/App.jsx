import { useEffect, useState } from 'react'
import { exercises, workouts } from './data.js'
import {
  appendSession,
  elapsedMilliseconds,
  formatDuration,
  loadActiveSession,
  saveActiveSession,
} from './storage.js'

const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))

function MediaFrame({ exercise }) {
  return (
    <div className="media-frame">
      <img
        src={exercise.media}
        alt={`${exercise.name} demonstration`}
        onError={(event) => { event.currentTarget.hidden = true }}
      />
      <span className="media-placeholder" aria-hidden="true">
        <span>Motion study</span>
        GIF pending
      </span>
    </div>
  )
}

function ExerciseDetails({ exercise, number }) {
  return (
    <>
      <MediaFrame exercise={exercise} />
      <div className="exercise-number" aria-hidden="true">{String(number).padStart(2, '0')}</div>
      <div className="exercise-copy">
        <div className="exercise-heading">
          <h3>{exercise.name}</h3>
          <p className="prescription">{exercise.prescription}</p>
        </div>
        <p className="cue">{exercise.cue}</p>
        <ul className="tags" aria-label="Training focus">
          {exercise.tags.map((tag) => <li key={tag}>{tag}</li>)}
          <li>{exercise.mode}</li>
        </ul>
      </div>
    </>
  )
}

function RepsLogger({ log, updateLog }) {
  const updateSet = (index, field, value) => {
    const sets = log.sets.map((set, setIndex) => setIndex === index ? { ...set, [field]: value } : set)
    updateLog({ ...log, sets })
  }

  return (
    <div className="set-logger">
      <div className="set-list">
        {log.sets.map((set, index) => (
          <fieldset className="set-row" key={index}>
            <legend>Set {index + 1}</legend>
            <label>
              Reps
              <input type="number" min="1" max="999" step="1" required value={set.reps} onChange={(event) => updateSet(index, 'reps', event.target.value)} />
            </label>
            <label>
              Weight <span>(kg, optional)</span>
              <input type="number" min="0.1" max="999" step="0.1" value={set.weightKg} onChange={(event) => updateSet(index, 'weightKg', event.target.value)} />
            </label>
            <button className="text-button" type="button" onClick={() => updateLog({ ...log, sets: log.sets.filter((_, setIndex) => setIndex !== index) })}>
              Remove set {index + 1}
            </button>
          </fieldset>
        ))}
      </div>
      <button className="secondary-button" type="button" onClick={() => updateLog({ ...log, sets: [...log.sets, { reps: '', weightKg: '' }] })}>
        + Add set
      </button>
      {log.sets.length === 0 && <p className="empty-note">No sets logged.</p>}
    </div>
  )
}

function DurationLogger({ exercise, log, updateLog, now }) {
  const elapsedMs = elapsedMilliseconds(log.timer, now)
  const running = log.timer.startedAt !== null
  const active = running || log.timer.elapsedMs > 0
  const targetDuration = Number(log.targetDuration)
  const validTarget = Number.isInteger(targetDuration) && targetDuration > 0 && targetDuration <= 3600

  const pauseOrResume = () => {
    updateLog({
      ...log,
      timer: running
        ? { elapsedMs, startedAt: null }
        : { elapsedMs: log.timer.elapsedMs, startedAt: now },
    })
  }

  const stop = () => {
    const durationSeconds = Math.floor(elapsedMs / 1000)
    updateLog({
      ...log,
      sets: durationSeconds > 0 ? [...log.sets, { durationSeconds }] : log.sets,
      timer: { elapsedMs: 0, startedAt: null },
    })
  }

  return (
    <div className="duration-logger">
      <label className="target-input">
        Target duration <span>(seconds)</span>
        <input type="number" min="1" max="3600" step="1" required value={log.targetDuration} onChange={(event) => updateLog({ ...log, targetDuration: event.target.value })} />
      </label>
      <div className="timer-readout" role="timer" aria-live="off">
        <strong>{formatDuration(elapsedMs)}</strong>
        <span>/ {formatDuration(validTarget ? targetDuration * 1000 : 0)}</span>
      </div>
      <div className="timer-controls" aria-label={`${exercise.name} timer controls`}>
        <button type="button" onClick={() => updateLog({ ...log, timer: { elapsedMs: 0, startedAt: now } })} disabled={active || !validTarget}>Start</button>
        <button type="button" onClick={pauseOrResume} disabled={!active}>{running ? 'Pause' : 'Resume'}</button>
        <button type="button" onClick={stop} disabled={!active}>Stop</button>
        <button type="button" onClick={() => updateLog({ ...log, timer: { elapsedMs: 0, startedAt: null } })} disabled={!active}>Reset</button>
      </div>
      <ol className="duration-sets" aria-label="Completed duration sets">
        {log.sets.map((set, index) => (
          <li key={index}>
            <span>Set {index + 1}: {formatDuration(set.durationSeconds * 1000)}</span>
            <button className="text-button" type="button" onClick={() => updateLog({ ...log, sets: log.sets.filter((_, setIndex) => setIndex !== index) })}>Remove</button>
          </li>
        ))}
      </ol>
      {log.sets.length === 0 && <p className="empty-note">Stop the timer to log a set.</p>}
    </div>
  )
}

function ExerciseRow({ exercise, number, log, updateLog, now }) {
  return (
    <li className={`exercise-row ${log ? 'logging' : ''}`}>
      <ExerciseDetails exercise={exercise} number={number} />
      {log && (
        <div className="exercise-controls">
          {exercise.mode === 'reps'
            ? <RepsLogger log={log} updateLog={updateLog} />
            : <DurationLogger exercise={exercise} log={log} updateLog={updateLog} now={now} />}
        </div>
      )}
    </li>
  )
}

function createSession(workout) {
  return {
    workoutId: workout.id,
    startedAt: Date.now(),
    exercises: Object.fromEntries(workout.exerciseIds.map((id) => {
      const exercise = exerciseById.get(id)
      return [id, exercise.mode === 'duration'
        ? { targetDuration: exercise.targetDuration, sets: [], timer: { elapsedMs: 0, startedAt: null } }
        : { sets: [] }]
    })),
  }
}

function restoreSession() {
  const session = loadActiveSession()
  const workout = session && workouts.find(({ id }) => id === session.workoutId)
  if (!workout) return null

  const exerciseIds = Object.keys(session.exercises)
  return workout.exerciseIds.every((id) => session.exercises[id])
    && exerciseIds.every((id) => workout.exerciseIds.includes(id))
    ? session
    : null
}

function validRepsSet(set) {
  const reps = Number(set.reps)
  const weight = set.weightKg === '' ? null : Number(set.weightKg)
  return Number.isInteger(reps) && reps > 0 && reps <= 999 && (weight === null || (weight > 0 && weight <= 999))
}

function App() {
  const [view, setView] = useState('train')
  const [activeSession, setActiveSession] = useState(restoreSession)
  const [now, setNow] = useState(() => Date.now())
  const [message, setMessage] = useState('')

  useEffect(() => {
    saveActiveSession(activeSession)
  }, [activeSession])

  useEffect(() => {
    if (!activeSession) return undefined
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [activeSession])

  const activeWorkout = activeSession && workouts.find(({ id }) => id === activeSession.workoutId)
  const repLogsValid = activeSession && Object.entries(activeSession.exercises).every(([id, log]) => (
    exerciseById.get(id).mode !== 'reps' || log.sets.every(validRepsSet)
  ))
  const hasSets = activeSession && Object.values(activeSession.exercises).some(({ sets }) => sets.length > 0)
  const canFinish = hasSets && repLogsValid

  const updateExercise = (id, log) => {
    setActiveSession((session) => ({ ...session, exercises: { ...session.exercises, [id]: log } }))
  }

  const finishSession = () => {
    if (!canFinish) {
      setMessage('Log at least one valid set before you finish this session.')
      return
    }

    const endedAt = Date.now()
    const completed = {
      id: `${activeSession.workoutId}-${activeSession.startedAt}`,
      workoutId: activeSession.workoutId,
      startedAt: new Date(activeSession.startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationSeconds: Math.floor((endedAt - activeSession.startedAt) / 1000),
      exercises: Object.entries(activeSession.exercises).flatMap(([exerciseId, log]) => {
        if (log.sets.length === 0) return []
        const exercise = exerciseById.get(exerciseId)
        const sets = exercise.mode === 'reps'
          ? log.sets.map((set) => ({ reps: Number(set.reps), ...(set.weightKg === '' ? {} : { weightKg: Number(set.weightKg) }) }))
          : log.sets
        return [{ exerciseId, sets }]
      }),
    }
    appendSession(completed)
    setActiveSession(null)
    setMessage('Workout saved to your training log.')
  }

  const cancelSession = () => {
    if (!window.confirm('Cancel this workout and discard all logged sets?')) return
    setActiveSession(null)
    setMessage('Workout canceled.')
  }

  const chooseView = (nextView) => {
    setView(nextView)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <header className="site-header">
        <button className="wordmark" type="button" onClick={() => chooseView('train')} aria-label="Work Set home">WORK<span>/</span>SET</button>
        <nav aria-label="Primary navigation">
          {['train', 'dashboard', 'log'].map((item) => (
            <button className={view === item ? 'active' : ''} type="button" key={item} onClick={() => chooseView(item)} aria-current={view === item ? 'page' : undefined}>
              {item}
            </button>
          ))}
        </nav>
        <p className="edition">Field log / 01</p>
      </header>

      {view === 'train' ? (
        <main id="top">
          <section className="hero" id="train" aria-labelledby="page-title">
            <p className="eyebrow">Two-day kettlebell protocol</p>
            <h1 id="page-title">Back. Shoulders.<br /><em>Rotation.</em></h1>
            <div className="hero-note">
              <p>Upper-body strength without meaningful squat, lunge, or posterior-chain volume.</p>
              <dl>
                <div><dt>Frequency</dt><dd>2 days / week</dd></div>
                <div><dt>Duration</dt><dd>25–35 min</dd></div>
                <div><dt>Effort</dt><dd>3 reps in reserve</dd></div>
              </dl>
            </div>
            <div className="issue-mark" aria-hidden="true">02<span>sessions</span></div>
          </section>

          <p className="status-message" role="status">{message}</p>

          {activeSession && (
            <section className="session-bar" aria-label="Active workout">
              <div>
                <p className="eyebrow">Session in progress</p>
                <h2>Workout {activeWorkout.label}</h2>
              </div>
              <div className="overall-timer"><span>Elapsed</span><strong>{formatDuration(now - activeSession.startedAt)}</strong></div>
              <div className="session-actions">
                <button className="primary-button" type="button" onClick={finishSession} disabled={!canFinish}>Finish workout</button>
                <button className="text-button" type="button" onClick={cancelSession}>Cancel session</button>
              </div>
              {!canFinish && <p className="finish-note">Log at least one valid set to finish.</p>}
            </section>
          )}

          <div className="workouts">
            {(activeWorkout ? [activeWorkout] : workouts).map((workout) => (
              <section className="workout" key={workout.id} aria-labelledby={`${workout.id}-title`}>
                <header className="workout-header">
                  <p>Workout <strong>{workout.label}</strong></p>
                  <div>
                    <h2 id={`${workout.id}-title`}>{workout.name}</h2>
                    <p>{workout.note}</p>
                    {!activeSession && <button className="primary-button begin-button" type="button" onClick={() => { setActiveSession(createSession(workout)); setNow(Date.now()); setMessage('') }}>Begin workout {workout.label}</button>}
                  </div>
                </header>
                <ol className="exercise-list">
                  {workout.exerciseIds.map((id, index) => (
                    <ExerciseRow
                      key={id}
                      exercise={exerciseById.get(id)}
                      number={index + 1}
                      log={activeSession?.exercises[id]}
                      updateLog={(log) => updateExercise(id, log)}
                      now={now}
                    />
                  ))}
                </ol>
              </section>
            ))}
          </div>

          {!activeSession && <aside className="progression" aria-labelledby="progression-title">
            <p className="eyebrow">Loading notes</p>
            <h2 id="progression-title">Build the work.<br />Keep the form.</h2>
            <ol>
              <li><strong>Weeks 1–2</strong><span>Two sets or rounds per workout.</span></li>
              <li><strong>Weeks 3–4</strong><span>Use three if recovery remains good.</span></li>
              <li><strong>After</strong><span>Add reps or weight, not both in one week.</span></li>
            </ol>
          </aside>}
        </main>
      ) : (
        <main className="placeholder-view">
          <p className="eyebrow">Next field note</p>
          <h1>{view === 'dashboard' ? 'Progress is coming.' : 'Your log is coming.'}</h1>
          <p>Completed workouts are stored on this device and are ready for this view.</p>
          <button className="primary-button" type="button" onClick={() => chooseView('train')}>Return to training</button>
        </main>
      )}

      <footer className="site-footer">
        <strong>Train with control.</strong>
        <p>Stop any movement that causes sharp pain, numbness, or loss of control.</p>
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Return to top ↑</button>
      </footer>
    </>
  )
}

export default App
