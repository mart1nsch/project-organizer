# Project Organizer

A personal project management web app built with FastAPI and vanilla JavaScript. Create and track your projects, their tasks, and milestones — all in one place, with a clean dark UI.

## Features

- **Projects** — create, edit, and delete projects with a name, description, status, tags, and an optional GitHub repository link
- **Tasks & Milestones** — add tasks and milestones inside each project; mark them complete, set priority, and drag to reorder
- **Priority** — color-coded badge (High / Med / Low) on each item; click it to open a dropdown and change priority in place without moving the item
- **Drag-and-drop reorder** — drag any task or milestone to a new position; order is persisted to the database
- **Status tracking** — four statuses: Idea, In Progress, Completed, Paused — each with its own color
- **Tags** — add multiple tags to a project; filter the project list by tag
- **GitHub link** — store the repo URL on a project and open it in one click from the project page or the detail panel
- **Search & filter** — search by name, description, or tag; filter by status; sort by newest, oldest, or name
- **Detail panel** — click any project card to open a slide-in panel with full details without leaving the main page

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3, FastAPI, SQLAlchemy |
| Database | SQLite (`projects.db`) |
| Frontend | Vanilla HTML, CSS, JavaScript — no build step |
| Font | Nunito (Google Fonts) |

## Getting started

```bash
# Install dependencies
pip install -r requirements.txt

# Start the development server
uvicorn main:app --reload
```

App is available at **http://localhost:8000**.

The database file (`projects.db`) is created automatically on first run. Migrations for new columns are applied automatically on startup — existing data is never dropped.

## Project structure

```
project-organizer/
├── main.py          # FastAPI app — all routes and Pydantic schemas
├── database.py      # SQLAlchemy models, engine, migrations
├── requirements.txt
└── static/
    ├── index.html   # Main page (project list)
    ├── project.html # Project detail page (tasks & milestones)
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── app.js       # Main page logic
    │   └── project.js   # Project detail page logic
    └── img/
        └── github.png
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create a project |
| GET | `/api/projects/{id}` | Get a single project |
| PUT | `/api/projects/{id}` | Update a project (full replace) |
| DELETE | `/api/projects/{id}` | Delete a project and all its tasks/milestones |
| GET | `/api/projects/{id}/tasks` | List tasks for a project |
| POST | `/api/projects/{id}/tasks` | Create a task |
| PATCH | `/api/tasks/{id}` | Update a task (partial) |
| DELETE | `/api/tasks/{id}` | Delete a task |
| PUT | `/api/projects/{id}/tasks/reorder` | Persist drag-and-drop order |
| GET | `/api/projects/{id}/milestones` | List milestones for a project |
| POST | `/api/projects/{id}/milestones` | Create a milestone |
| PATCH | `/api/milestones/{id}` | Update a milestone (partial) |
| DELETE | `/api/milestones/{id}` | Delete a milestone |
| PUT | `/api/projects/{id}/milestones/reorder` | Persist drag-and-drop order |

## Design

Dark blue theme — backgrounds layer from `#0d1117` up to `#212d42`, accent color is `#4db6f0` (VSCode-style blue). All colors are defined as CSS variables in `:root` inside `style.css`. No hardcoded color values anywhere else.
