# Coding Tracker — C++ Problem Vault

A React + Vite app to organize coding **categories** and the **C++ problem
solutions** under each one. All data is stored in a GitHub repository folder
that acts as a lightweight database, so your progress syncs across devices.

- **App repo (this project):** `coding-tracker-tool`
- **Data repo (your database):** `stalinTechXD/coding-data` → `database/` folder

## Features

- Create categories and add C++ problems (title, statement, code) to each.
- Syntax-highlighted C++ code blocks with copy-to-clipboard.
- **Dashboard** with daily progress: totals, today/this-week counts, current and
  longest streaks, a 14-day activity bar, and an activity heatmap.
- Data persisted to GitHub via the Contents API (no local database).

## Configuration

Settings are read from [`public/appsettings.json`](public/appsettings.json):

```json
{
  "github": {
    "owner": "stalinTechXD",
    "repo": "coding-data",
    "branch": "master",
    "dbFolder": "database",
    "token": "github_pat_..."
  }
}
```

- `owner` / `repo` — the GitHub repository used as the database.
- `branch` — branch to read/write (e.g. `master` or `main`).
- `dbFolder` — folder inside the repo where category JSON files live.
- `token` — a GitHub token with Contents read/write on the data repo.

> Security note: the token in `appsettings.json` is served to the browser and is
> therefore publicly visible on a deployed site. Use a **fine-grained token**
> scoped to only the `coding-data` repo with **Contents: read/write**, so the
> exposure is limited to that single repo.

## Run locally

```powershell
npm install
npm run dev
```

The dev server runs at http://localhost:5173 (it picks the next free port if
that one is taken). GitHub API calls are routed through the Vite dev proxy.

## Build

```powershell
npm run build      # outputs to dist/
npm run preview    # preview the production build
```

## Deploy to Netlify

1. Commit the project (including `public/appsettings.json`).
2. In Netlify: **Add new site → Import from Git** and pick this repo.
3. Build command: `npm run build` — Publish directory: `dist`
   (already set in [`netlify.toml`](netlify.toml)).
4. Deploy. The app reads config from `appsettings.json` and talks to the GitHub
   API directly (GitHub's API supports CORS).

## Project structure

```
public/appsettings.json   GitHub config (owner/repo/branch/dbFolder/token)
src/github.js             GitHub Contents API client
src/storage.js            appsettings loader + helpers
src/App.jsx               app shell and data orchestration
src/components/           Dashboard, SettingsModal, ProblemModal, CodeBlock
netlify.toml              Netlify build + SPA fallback
vite.config.js            dev server + GitHub proxy
```
