import { exercises, workouts } from './data.js'

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

function ExerciseRow({ exercise, number }) {
  return (
    <li className="exercise-row">
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
    </li>
  )
}

function App() {
  return (
    <>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Work Set home">
          WORK<span>/</span>SET
        </a>
        <nav aria-label="Primary navigation">
          <a className="active" href="#train" aria-current="page">Train</a>
          <a href="#progress">Progress</a>
          <a href="#log">Log</a>
        </nav>
        <p className="edition">Field log / 01</p>
      </header>

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

        <div className="workouts">
          {workouts.map((workout) => (
            <section className="workout" key={workout.id} aria-labelledby={`${workout.id}-title`}>
              <header className="workout-header">
                <p>Workout <strong>{workout.label}</strong></p>
                <div>
                  <h2 id={`${workout.id}-title`}>{workout.name}</h2>
                  <p>{workout.note}</p>
                </div>
              </header>
              <ol className="exercise-list">
                {workout.exerciseIds.map((id, index) => (
                  <ExerciseRow key={id} exercise={exerciseById.get(id)} number={index + 1} />
                ))}
              </ol>
            </section>
          ))}
        </div>

        <aside className="progression" id="progress" aria-labelledby="progression-title">
          <p className="eyebrow">Loading notes</p>
          <h2 id="progression-title">Build the work.<br />Keep the form.</h2>
          <ol>
            <li><strong>Weeks 1–2</strong><span>Two sets or rounds per workout.</span></li>
            <li><strong>Weeks 3–4</strong><span>Use three if recovery remains good.</span></li>
            <li><strong>After</strong><span>Add reps or weight, not both in one week.</span></li>
          </ol>
        </aside>
      </main>

      <footer className="site-footer" id="log">
        <strong>Train with control.</strong>
        <p>Stop any movement that causes sharp pain, numbness, or loss of control.</p>
        <a href="#top">Return to top ↑</a>
      </footer>
    </>
  )
}

export default App
