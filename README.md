# Work Set

Work Set is a mobile-first kettlebell workout tracker. It runs in the browser and does not use a backend.

## Features

- View two kettlebell workouts and their exercises.
- Log sets, repetitions, weight, and exercise duration.
- Use a five-second ready countdown for timed exercises.
- Track the total workout duration.
- Review completed workouts in a chronological log.
- View workout duration and exercise progress charts.
- Install the application as a Progressive Web App (PWA).
- Use the application and all exercise GIFs offline.

## Requirements

- Node.js 20 or later
- npm

## Development

Install the dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

Open the URL that Vite shows in the terminal.

## Production Build

Create the production build:

```sh
npm run build
```

Preview the production build:

```sh
npm run preview
```

The service worker runs only in the production build.

## Checks

Run all project checks:

```sh
npm run check
npm run lint
npm run build
```

## PWA Installation

1. Open the production application in a supported browser.
2. Select the browser option to install the application.
3. Open Work Set from the device home screen.

The service worker stores the application shell and all exercise GIFs during installation.

## Data Storage

Work Set stores all workout data in browser `localStorage`.

- `work-set.active-session` stores the current workout.
- `work-set.session-log` stores completed workouts.

Clearing browser site data deletes the workout history. Data does not synchronize between devices.

## Exercise Data

Edit `src/data.js` to change workouts, exercises, prescriptions, cues, media paths, or tutorial links.

Exercise GIFs are in `public/media/`. See [`public/media/SOURCES.md`](public/media/SOURCES.md) for video attribution and excerpt times.
