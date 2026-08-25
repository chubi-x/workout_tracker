import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { exercises, workouts } from './data.js'
import {
  appendSession,
  elapsedMilliseconds,
  formatDuration,
  loadActiveSession,
  loadSessionLog,
  removeSession,
  saveActiveSession,
} from './storage.js'
import { exerciseProgressSeries, workoutDurationSeries } from './progress.js'
import { completedRepsSets, validOrEmptyRepsSet, validRepsSet } from './session.js'

const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
const workoutById = new Map(workouts.map((workout) => [workout.id, workout]))
const dateFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const DEFAULT_WEIGHT_KG = 16
const TIMER_BUFFER_MS = 5_000

function formatDate(value) {
  return dateFormatter.format(new Date(value))
}

function ChartTooltip({ active, payload, formatValue }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  return (
    <div className="chart-tooltip">
      <time dateTime={point.date}>{formatDate(point.date)}</time>
      <strong>{formatValue(point.value)}</strong>
    </div>
  )
}

function LineChart({ label, series, formatValue }) {
  const [selection, setSelection] = useState(null)
  const chartData = series.map((point, index) => ({ ...point, index }))
  const selectedIndex = selection?.label === label ? selection.index : null
  const selectedPoint = chartData.find(({ index }) => index === selectedIndex)

  const renderDot = ({ cx, cy, payload }) => (
    <circle
      className={`chart-point ${selectedIndex === payload.index ? 'selected' : ''}`}
      cx={cx}
      cy={cy}
      r="5"
      role="button"
      tabIndex="0"
      aria-label={`${formatDate(payload.date)}: ${formatValue(payload.value)}`}
      onClick={() => setSelection({ label, index: payload.index })}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setSelection({ label, index: payload.index })
        }
      }}
    />
  )

  return (
    <div className="line-chart" role="group" aria-label={label}>
      <div className="chart-canvas">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 8 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="rgb(21 21 18 / 20%)" />
            <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={32} tickLine={false} axisLine={{ stroke: 'rgb(21 21 18 / 35%)' }} />
            <YAxis domain={[0, 'auto']} tickFormatter={formatValue} width={72} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip formatValue={formatValue} />} cursor={{ stroke: 'rgb(21 21 18 / 35%)' }} />
            <Line type="linear" dataKey="value" stroke="var(--orange)" strokeWidth={3} dot={renderDot} activeDot={false} isAnimationActive={false} />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-selection" aria-live="polite">
        {selectedPoint
          ? <><time dateTime={selectedPoint.date}>{formatDate(selectedPoint.date)}</time><strong>{formatValue(selectedPoint.value)}</strong></>
          : <span>Hover over or select a point to view its value.</span>}
      </p>
    </div>
  )
}

function EmptyView({ title, children, chooseView }) {
  return (
    <main className="empty-view">
      <p className="eyebrow">No entries yet</p>
      <h1>{title}</h1>
      <p>{children}</p>
      <button className="primary-button" type="button" onClick={() => chooseView('home')}>Go to Home</button>
    </main>
  )
}

function ProgressView({ sessions, chooseView }) {
  const loggedExercises = exercises.filter((exercise) => sessions.some((session) => session.exercises.some(({ exerciseId }) => exerciseId === exercise.id)))
  const [selectedId, setSelectedId] = useState('')
  const selectedExercise = loggedExercises.find(({ id }) => id === selectedId) ?? loggedExercises[0]

  if (!sessions.length) {
    return <EmptyView title="No progress data." chooseView={chooseView}>Complete a workout to start your progress report.</EmptyView>
  }

  const latest = sessions.at(-1)
  const durationSeries = workoutDurationSeries(sessions)
  const exerciseSeries = exerciseProgressSeries(sessions, selectedExercise.id, selectedExercise.mode)
  const hasWeights = selectedExercise.mode === 'reps' && exerciseSeries.some(({ bestWeightKg }) => bestWeightKg !== null)
  const trendSeries = exerciseSeries.flatMap((point) => {
    if (hasWeights && point.bestWeightKg === null) return []
    return [{ date: point.date, value: selectedExercise.mode === 'duration' ? point.bestDuration : hasWeights ? point.bestWeightKg : point.bestReps }]
  })
  const trendUnit = selectedExercise.mode === 'duration' ? 'duration' : hasWeights ? 'weight' : 'reps'
  const formatTrend = (value) => selectedExercise.mode === 'duration' ? formatDuration(value * 1000) : hasWeights ? `${value} kg` : `${value} reps`

  return (
    <main className="report-view">
      <header className="report-hero">
        <div><p className="eyebrow">Training progress</p><h1>Work,<br /><em>measured.</em></h1></div>
        <p>Each finished session adds data to these trends.</p>
      </header>
      <section className="metrics" aria-label="Progress summary">
        <div><span>Completed</span><strong>{sessions.length}</strong><small>workouts</small></div>
        <div><span>Training time</span><strong>{formatDuration(sessions.reduce((total, session) => total + session.durationSeconds, 0) * 1000)}</strong><small>total</small></div>
        <div><span>Most recent</span><strong>{workoutById.get(latest.workoutId)?.label ?? '—'}</strong><small>{formatDate(latest.startedAt)}</small></div>
      </section>
      <section className="report-section" aria-labelledby="duration-title">
        <header><div><p className="eyebrow">Training time</p><h2 id="duration-title">Workout duration</h2></div><p>{sessions.length} completed {sessions.length === 1 ? 'session' : 'sessions'}</p></header>
        <LineChart label="Workout duration over time" series={durationSeries} formatValue={(value) => formatDuration(value * 1000)} />
      </section>
      <section className="report-section exercise-progress" aria-labelledby="exercise-progress-title">
        <header>
          <div><p className="eyebrow">Exercise trend</p><h2 id="exercise-progress-title">Exercise progression</h2></div>
          <label>Exercise<select value={selectedExercise.id} onChange={(event) => setSelectedId(event.target.value)}>{loggedExercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label>
        </header>
        <p className="trend-label">Best {trendUnit} per session</p>
        <LineChart label={`${selectedExercise.name} best ${trendUnit} over time`} series={trendSeries} formatValue={formatTrend} />
        <ol className="trend-readout">
          {exerciseSeries.map((point) => (
            <li key={point.date}><time dateTime={point.date}>{formatDate(point.date)}</time><strong>{selectedExercise.mode === 'duration' ? formatDuration(point.bestDuration * 1000) : `Best reps: ${point.bestReps}${point.bestWeightKg === null ? '' : `; best weight: ${point.bestWeightKg} kg`}`}</strong></li>
          ))}
        </ol>
      </section>
    </main>
  )
}

function LogView({ sessions, chooseView, deleteSession }) {
  if (!sessions.length) {
    return <EmptyView title="The log is empty." chooseView={chooseView}>Complete a workout to make your first entry.</EmptyView>
  }

  return (
    <main className="log-view">
      <header className="log-header"><p className="eyebrow">Chronological record / Newest first</p><h1>Training<br /><em>log.</em></h1></header>
      <ol className="session-log">
        {[...sessions].reverse().map((session, index) => {
          const workout = workoutById.get(session.workoutId)
          return (
            <li key={session.id}>
              <article className="log-entry">
                <header>
                  <span className="log-number">{String(sessions.length - index).padStart(2, '0')}</span>
                  <div><time dateTime={session.startedAt}>{formatDate(session.startedAt)}</time><h2>{workout ? `Workout ${workout.label} / ${workout.name}` : session.workoutId}</h2></div>
                  <div className="log-duration"><span>Total duration</span><strong>{formatDuration(session.durationSeconds * 1000)}</strong></div>
                </header>
                <details>
                  <summary>View {session.exercises.length} logged {session.exercises.length === 1 ? 'exercise' : 'exercises'}</summary>
                  <div className="logged-exercises">
                    {session.exercises.map((log) => {
                      const exercise = exerciseById.get(log.exerciseId)
                      return <section key={log.exerciseId}><h3>{exercise?.name ?? log.exerciseId}</h3><ol>{log.sets.map((set, setIndex) => <li key={setIndex}><span>Set {setIndex + 1}</span><strong>{exercise?.mode === 'duration' ? formatDuration(set.durationSeconds * 1000) : `${set.reps} reps${set.weightKg === undefined ? '' : ` / ${set.weightKg} kg`}`}</strong></li>)}</ol></section>
                    })}
                  </div>
                </details>
                <button className="delete-button" type="button" onClick={() => deleteSession(session)}>Delete entry</button>
              </article>
            </li>
          )
        })}
      </ol>
    </main>
  )
}

function MediaFrame({ exercise }) {
  const [playing, setPlaying] = useState(true)

  return (
    <div className="media-frame">
      {playing && <img
        src={exercise.media}
        alt={`${exercise.name} demonstration`}
        onError={(event) => { event.currentTarget.hidden = true }}
      />}
      <span className="media-placeholder" aria-hidden="true">
        <span>Motion study</span>
        Demonstration stopped
      </span>
      <a className="media-source" href={exercise.source} target="_blank" rel="noopener noreferrer">Tutorial ↗</a>
      <button className="media-control" type="button" aria-label={playing ? 'Stop animation' : 'Play animation'} onClick={() => setPlaying((value) => !value)}>
        {playing
          ? <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" /></svg>
          : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5 13 8l-9 5.5z" /></svg>}
      </button>
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
              <input type="number" inputMode="numeric" min="1" max="999" step="1" required value={set.reps} onInput={(event) => updateSet(index, 'reps', event.currentTarget.value)} />
            </label>
            <label>
              Weight <span>(kg, optional)</span>
              <input type="number" inputMode="decimal" min="0.1" max="999" step="0.1" value={set.weightKg} onInput={(event) => updateSet(index, 'weightKg', event.currentTarget.value)} />
            </label>
            <button className="text-button" type="button" onClick={() => updateLog({ ...log, sets: log.sets.filter((_, setIndex) => setIndex !== index) })}>
              Remove set {index + 1}
            </button>
          </fieldset>
        ))}
      </div>
      <button className="secondary-button" type="button" onClick={() => updateLog({ ...log, sets: [...log.sets, { reps: '', weightKg: DEFAULT_WEIGHT_KG }] })}>
        + Add set
      </button>
      {log.sets.length === 0 && <p className="empty-note">No sets logged.</p>}
    </div>
  )
}

function DurationLogger({ exercise, log, updateLog, now }) {
  const elapsedMs = elapsedMilliseconds(log.timer, now)
  const running = log.timer.startedAt !== null
  const readySeconds = running ? Math.max(0, Math.ceil((log.timer.startedAt - now) / 1000)) : 0
  const preparing = readySeconds > 0
  const active = running || log.timer.elapsedMs > 0
  const targetDuration = Number(log.targetDuration)
  const validTarget = Number.isInteger(targetDuration) && targetDuration > 0 && targetDuration <= 3600

  const pauseOrResume = () => {
    const actionTime = Date.now()
    const actionElapsed = elapsedMilliseconds(log.timer, actionTime)
    updateLog({
      ...log,
      timer: running
        ? { elapsedMs: actionElapsed, startedAt: null }
        : { elapsedMs: log.timer.elapsedMs, startedAt: actionTime },
    })
  }

  const stop = () => {
    const durationSeconds = Math.floor(elapsedMilliseconds(log.timer) / 1000)
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
        <input type="number" inputMode="numeric" min="1" max="3600" step="1" required value={log.targetDuration} onInput={(event) => updateLog({ ...log, targetDuration: event.currentTarget.value })} />
      </label>
      <div className="timer-readout" role="timer" aria-live="off">
        {preparing ? <><strong>{readySeconds}</strong><span>Get ready</span></> : <><strong>{formatDuration(elapsedMs)}</strong><span>/ {formatDuration(validTarget ? targetDuration * 1000 : 0)}</span></>}
      </div>
      <div className="timer-controls" aria-label={`${exercise.name} timer controls`}>
        <button type="button" onClick={() => updateLog({ ...log, timer: { elapsedMs: 0, startedAt: Date.now() + TIMER_BUFFER_MS } })} disabled={active || !validTarget}>Start</button>
        <button type="button" onClick={pauseOrResume} disabled={!active || preparing}>{running ? 'Pause' : 'Resume'}</button>
        <button type="button" onClick={stop} disabled={!active || preparing}>Stop</button>
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

function HomeView({ activeSession, openWorkout, startWorkout }) {
  return (
    <main className="app-home">
      <header className="app-page-header">
        <div><p className="eyebrow">Training plan</p><h1>Workouts</h1></div>
        <p>Choose a workout to view the exercises or start a session.</p>
      </header>
      <section className="workout-overview" aria-label="Workout overview">
        {workouts.map((workout) => {
          const workoutExercises = workout.exerciseIds.map((id) => exerciseById.get(id))
          const isActive = activeSession?.workoutId === workout.id
          return (
            <article className="workout-card" key={workout.id}>
              <MediaFrame exercise={workoutExercises[0]} />
              <div className="workout-card-copy">
                <div className="workout-card-title"><span>Workout {workout.label}</span><strong>{workout.exerciseIds.length} exercises</strong></div>
                <h2>{workout.name}</h2>
                <p>{workout.note}</p>
                <ul aria-label={`Exercises in workout ${workout.label}`}>
                  {workoutExercises.map((exercise) => <li key={exercise.id}>{exercise.name}</li>)}
                </ul>
              </div>
              <div className="workout-card-actions">
                <button className="secondary-button" type="button" onClick={() => openWorkout(workout.id)}>View workout</button>
                <button className="primary-button" type="button" disabled={Boolean(activeSession) && !isActive} onClick={() => isActive ? openWorkout(workout.id) : startWorkout(workout)}>{isActive ? 'Continue session' : 'Start session'}</button>
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}

function WorkoutDetailView({ workout, activeSession, now, message, updateExercise, startWorkout, finishSession, cancelSession, openWorkout, goHome, canFinish, hasActiveTimer }) {
  const isActive = activeSession?.workoutId === workout.id
  return (
    <main className="workout-detail">
      <button className="back-button" type="button" onClick={goHome}>← All workouts</button>
      <header className="detail-header">
        <div><p className="eyebrow">Workout {workout.label}</p><h1>{workout.name}</h1></div>
        <div className="detail-summary"><strong>{workout.exerciseIds.length} exercises</strong><p>{workout.note}</p></div>
      </header>
      <p className="status-message" role="status">{message}</p>
      {isActive ? (
        <section className="session-bar" aria-label="Active workout">
          <div><p className="eyebrow">Session in progress</p><h2>Workout {workout.label}</h2></div>
          <div className="overall-timer"><span>Elapsed</span><strong>{formatDuration(Math.max(0, now - activeSession.startedAt))}</strong></div>
          <div className="session-actions">
            <button className="primary-button" type="button" onClick={finishSession} disabled={!canFinish}>Finish workout</button>
            <button className="text-button" type="button" onClick={cancelSession}>Cancel session</button>
          </div>
          {!canFinish && <p className="finish-note">{hasActiveTimer ? 'Stop or reset each exercise timer before you finish.' : 'Log at least one valid set to finish.'}</p>}
        </section>
      ) : activeSession ? (
        <button className="primary-button detail-start" type="button" onClick={() => openWorkout(activeSession.workoutId)}>Continue active workout</button>
      ) : (
        <button className="primary-button detail-start" type="button" onClick={() => startWorkout(workout)}>Start session with 16 kg</button>
      )}
      <section className="detail-exercises" aria-labelledby={`${workout.id}-exercises`}>
        <h2 id={`${workout.id}-exercises`}>Exercises</h2>
        <ol className="exercise-list">
          {workout.exerciseIds.map((id, index) => (
            <ExerciseRow key={id} exercise={exerciseById.get(id)} number={index + 1} log={isActive ? activeSession.exercises[id] : null} updateLog={(log) => updateExercise(id, log)} now={now} />
          ))}
        </ol>
      </section>
    </main>
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

function App() {
  const [view, setView] = useState('home')
  const [activeSession, setActiveSession] = useState(restoreSession)
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(() => activeSession?.workoutId ?? null)
  const [sessionLog, setSessionLog] = useState(loadSessionLog)
  const [now, setNow] = useState(() => Date.now())
  const [message, setMessage] = useState('')
  const hasActiveSession = activeSession !== null

  useEffect(() => {
    saveActiveSession(activeSession)
  }, [activeSession])

  useEffect(() => {
    if (!hasActiveSession) return undefined
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [hasActiveSession])

  const repLogsValid = activeSession && Object.entries(activeSession.exercises).every(([id, log]) => (
    exerciseById.get(id).mode !== 'reps' || log.sets.every(validOrEmptyRepsSet)
  ))
  const hasSets = activeSession && Object.entries(activeSession.exercises).some(([id, log]) => (
    exerciseById.get(id).mode === 'reps' ? log.sets.some(validRepsSet) : log.sets.length > 0
  ))
  const hasActiveTimer = activeSession && Object.values(activeSession.exercises).some(({ timer }) => timer && (timer.startedAt !== null || timer.elapsedMs > 0))
  const canFinish = hasSets && repLogsValid && !hasActiveTimer

  const updateExercise = (id, log) => {
    setActiveSession((session) => ({ ...session, exercises: { ...session.exercises, [id]: log } }))
  }

  const openWorkout = (workoutId) => {
    setView('home')
    setSelectedWorkoutId(workoutId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startWorkout = (workout) => {
    setActiveSession(createSession(workout))
    setNow(Date.now())
    setMessage('')
    openWorkout(workout.id)
  }

  const finishSession = () => {
    if (!canFinish) {
      setMessage('Log at least one valid set before you finish this session.')
      return
    }

    const endedAt = Date.now()
    const completed = {
      id: crypto.randomUUID(),
      workoutId: activeSession.workoutId,
      startedAt: new Date(activeSession.startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationSeconds: Math.max(0, Math.floor((endedAt - activeSession.startedAt) / 1000)),
      exercises: Object.entries(activeSession.exercises).flatMap(([exerciseId, log]) => {
        if (log.sets.length === 0) return []
        const exercise = exerciseById.get(exerciseId)
        const sets = exercise.mode === 'reps'
          ? completedRepsSets(log.sets).map((set) => ({ reps: Number(set.reps), ...(set.weightKg === '' ? {} : { weightKg: Number(set.weightKg) }) }))
          : log.sets
        if (sets.length === 0) return []
        return [{ exerciseId, sets }]
      }),
    }
    setSessionLog(appendSession(completed))
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
    if (nextView === 'home') setSelectedWorkoutId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteSession = (session) => {
    if (!window.confirm(`Delete the ${formatDate(session.startedAt)} workout? This cannot be undone.`)) return
    setSessionLog(removeSession(session.id))
  }

  return (
    <>
      <header className="site-header">
        <button className="wordmark" type="button" onClick={() => chooseView('home')} aria-label="Work Set home">WORK<span>/</span>SET</button>
        <nav aria-label="Primary navigation">
          {['home', 'progress', 'log'].map((item) => (
            <button className={view === item ? 'active' : ''} type="button" key={item} onClick={() => chooseView(item)} aria-current={view === item ? 'page' : undefined}>
              {item}
            </button>
          ))}
        </nav>
        <p className="edition">Field log / 01</p>
      </header>

      {view === 'home' ? selectedWorkoutId
        ? <WorkoutDetailView workout={workoutById.get(selectedWorkoutId)} activeSession={activeSession} now={now} message={message} updateExercise={updateExercise} startWorkout={startWorkout} finishSession={finishSession} cancelSession={cancelSession} openWorkout={openWorkout} goHome={() => chooseView('home')} canFinish={canFinish} hasActiveTimer={hasActiveTimer} />
        : <HomeView activeSession={activeSession} openWorkout={openWorkout} startWorkout={startWorkout} />
        : view === 'progress'
        ? <ProgressView sessions={sessionLog} chooseView={chooseView} />
        : <LogView sessions={sessionLog} chooseView={chooseView} deleteSession={deleteSession} />}

    </>
  )
}

export default App
