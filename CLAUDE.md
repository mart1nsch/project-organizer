# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Backend**: Python / FastAPI + SQLAlchemy (SQLite, file `projects.db`)
- **Frontend**: Vanilla HTML, CSS, JavaScript — no build step, no frameworks

## Running the app

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

App runs at http://localhost:8000.

## Architecture

**Backend**
- `database.py` — SQLAlchemy engine, `ProjectDB` model, `get_db` dependency. Tags stored as a comma-separated string.
- `main.py` — FastAPI app. Serves `static/index.html` at `/`. CRUD under `/api/projects`. Uses a shared `ProjectIn` schema for both create and update (full replace on PUT).

**Frontend** (`static/`)
- `index.html` — single-page layout: header, filter toolbar, card grid, create/edit modal, delete confirm modal.
- `css/style.css` — all styles; CSS variables for theming at `:root`.
- `js/app.js` — state (`projects`, `activeFilter`, `searchQuery`, `sortBy`, `activeTagFilter`), API calls via `api()` helper, rendering via `cardHTML()`, modal and tag-chip logic.

The frontend renders entirely from the in-memory `projects` array after each mutation — no page reloads.

## API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/projects` | Returns all projects, newest first |
| POST | `/api/projects` | Body: `ProjectIn` |
| PUT | `/api/projects/{id}` | Full replace, body: `ProjectIn` |
| DELETE | `/api/projects/{id}` | 204 on success |

## Design system

All UI must follow the established dark blue theme — do not deviate from it.

- **Font**: Nunito (Google Fonts, already imported in `index.html`) — `font-size: 16px` base
- **Backgrounds**: `--bg #0d1117` → `--surface #161b22` → `--surface-2 #1c2333` → `--surface-3 #212d42`
- **Accent**: `--primary #4db6f0` (VSCode-style blue); primary buttons use dark text on this color
- **Text**: `--text #e2eaf4` / `--text-secondary #8ba0ba` / `--text-muted #4a6080`
- **Status colors**: purple=Idea, blue=In Progress, teal=Completed, slate=Paused
- **Cards**: `--surface` background, 2px colored top border per status, hover gets blue glow shadow
- Never hardcode colors — always use the CSS variables defined in `:root` in `style.css`
- No warm or brown tones anywhere

## Project fields

`id`, `name`, `description` (nullable), `status` (`idea` / `in_progress` / `completed` / `paused`), `tags` (array in API, comma-separated in DB), `created_at`, `updated_at`.
