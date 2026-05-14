from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import database

database.Base.metadata.create_all(bind=database.engine)
database.run_migrations(database.engine)

app = FastAPI(title="Project Organizer")
app.mount("/static", StaticFiles(directory="static"), name="static")

VALID_STATUSES = {"idea", "in_progress", "completed", "paused"}
VALID_PRIORITIES = {"none", "low", "medium", "high"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProjectIn(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "idea"
    tags: List[str] = []
    github_url: Optional[str] = None

class ProjectOut(BaseModel):
    id: int; name: str; description: Optional[str]; status: str
    tags: List[str]; github_url: Optional[str]; created_at: datetime; updated_at: datetime
    class Config: from_attributes = True

class TaskIn(BaseModel):
    title: str
    notes: Optional[str] = None

class TaskPatch(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    completed: Optional[bool] = None
    priority: Optional[str] = None

class TaskOut(BaseModel):
    id: int; project_id: int; title: str; notes: Optional[str]
    completed: bool; priority: str; position: int; created_at: datetime
    class Config: from_attributes = True

class MilestoneIn(BaseModel):
    title: str
    description: Optional[str] = None

class MilestonePatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None
    priority: Optional[str] = None

class MilestoneOut(BaseModel):
    id: int; project_id: int; title: str; description: Optional[str]
    completed: bool; priority: str; position: int; created_at: datetime
    class Config: from_attributes = True

class ReorderBody(BaseModel):
    ids: List[int]


# ── Helpers ───────────────────────────────────────────────────────────────────

def db_to_out(p):
    tags = [t.strip() for t in p.tags.split(",") if t.strip()] if p.tags else []
    return ProjectOut(id=p.id, name=p.name, description=p.description,
                      status=p.status, tags=tags, github_url=p.github_url,
                      created_at=p.created_at, updated_at=p.updated_at)

def task_to_out(t):
    return TaskOut(id=t.id, project_id=t.project_id, title=t.title, notes=t.notes,
                   completed=t.completed, priority=t.priority or "none",
                   position=t.position or 0, created_at=t.created_at)

def milestone_to_out(m):
    return MilestoneOut(id=m.id, project_id=m.project_id, title=m.title, description=m.description,
                        completed=m.completed, priority=m.priority or "none",
                        position=m.position or 0, created_at=m.created_at)


# ── Pages ─────────────────────────────────────────────────────────────────────

@app.get("/")
def root(): return FileResponse("static/index.html")

@app.get("/project/{project_id}")
def project_page(project_id: int): return FileResponse("static/project.html")


# ── Projects ──────────────────────────────────────────────────────────────────

@app.get("/api/projects", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(database.get_db)):
    return [db_to_out(p) for p in
            db.query(database.ProjectDB).order_by(database.ProjectDB.created_at.desc()).all()]

@app.get("/api/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(database.get_db)):
    p = db.query(database.ProjectDB).filter(database.ProjectDB.id == project_id).first()
    if not p: raise HTTPException(404, "Project not found")
    return db_to_out(p)

@app.post("/api/projects", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectIn, db: Session = Depends(database.get_db)):
    if body.status not in VALID_STATUSES: raise HTTPException(422, "Invalid status")
    p = database.ProjectDB(name=body.name.strip(), description=body.description or None,
                            status=body.status, tags=",".join(t.strip() for t in body.tags if t.strip()),
                            github_url=body.github_url or None)
    db.add(p); db.commit(); db.refresh(p)
    return db_to_out(p)

@app.put("/api/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, body: ProjectIn, db: Session = Depends(database.get_db)):
    p = db.query(database.ProjectDB).filter(database.ProjectDB.id == project_id).first()
    if not p: raise HTTPException(404, "Project not found")
    if body.status not in VALID_STATUSES: raise HTTPException(422, "Invalid status")
    p.name = body.name.strip(); p.description = body.description or None
    p.status = body.status; p.tags = ",".join(t.strip() for t in body.tags if t.strip())
    p.github_url = body.github_url or None
    p.updated_at = datetime.utcnow()
    db.commit(); db.refresh(p)
    return db_to_out(p)

@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(database.get_db)):
    p = db.query(database.ProjectDB).filter(database.ProjectDB.id == project_id).first()
    if not p: raise HTTPException(404, "Project not found")
    db.query(database.TaskDB).filter(database.TaskDB.project_id == project_id).delete()
    db.query(database.MilestoneDB).filter(database.MilestoneDB.project_id == project_id).delete()
    db.delete(p); db.commit()


# ── Tasks ─────────────────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/tasks", response_model=List[TaskOut])
def list_tasks(project_id: int, db: Session = Depends(database.get_db)):
    return [task_to_out(t) for t in
            db.query(database.TaskDB)
              .filter(database.TaskDB.project_id == project_id)
              .order_by(database.TaskDB.position.asc(), database.TaskDB.created_at.asc()).all()]

@app.post("/api/projects/{project_id}/tasks", response_model=TaskOut, status_code=201)
def create_task(project_id: int, body: TaskIn, db: Session = Depends(database.get_db)):
    if not db.query(database.ProjectDB).filter(database.ProjectDB.id == project_id).first():
        raise HTTPException(404, "Project not found")
    # Assign position after the last existing task
    last = db.query(database.TaskDB).filter(database.TaskDB.project_id == project_id)\
              .order_by(database.TaskDB.position.desc()).first()
    t = database.TaskDB(project_id=project_id, title=body.title.strip(),
                        notes=body.notes or None, position=(last.position + 1) if last else 0)
    db.add(t); db.commit(); db.refresh(t)
    return task_to_out(t)

@app.patch("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, body: TaskPatch, db: Session = Depends(database.get_db)):
    t = db.query(database.TaskDB).filter(database.TaskDB.id == task_id).first()
    if not t: raise HTTPException(404, "Task not found")
    if body.title is not None: t.title = body.title.strip()
    if body.notes is not None: t.notes = body.notes or None
    if body.completed is not None: t.completed = body.completed
    if body.priority is not None:
        if body.priority not in VALID_PRIORITIES: raise HTTPException(422, "Invalid priority")
        t.priority = body.priority
    db.commit(); db.refresh(t)
    return task_to_out(t)

@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(database.get_db)):
    t = db.query(database.TaskDB).filter(database.TaskDB.id == task_id).first()
    if not t: raise HTTPException(404, "Task not found")
    db.delete(t); db.commit()

@app.put("/api/projects/{project_id}/tasks/reorder", status_code=204)
def reorder_tasks(project_id: int, body: ReorderBody, db: Session = Depends(database.get_db)):
    for pos, task_id in enumerate(body.ids):
        db.query(database.TaskDB).filter(
            database.TaskDB.id == task_id,
            database.TaskDB.project_id == project_id,
        ).update({"position": pos})
    db.commit()


# ── Milestones ────────────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/milestones", response_model=List[MilestoneOut])
def list_milestones(project_id: int, db: Session = Depends(database.get_db)):
    return [milestone_to_out(m) for m in
            db.query(database.MilestoneDB)
              .filter(database.MilestoneDB.project_id == project_id)
              .order_by(database.MilestoneDB.position.asc(), database.MilestoneDB.created_at.asc()).all()]

@app.post("/api/projects/{project_id}/milestones", response_model=MilestoneOut, status_code=201)
def create_milestone(project_id: int, body: MilestoneIn, db: Session = Depends(database.get_db)):
    if not db.query(database.ProjectDB).filter(database.ProjectDB.id == project_id).first():
        raise HTTPException(404, "Project not found")
    last = db.query(database.MilestoneDB).filter(database.MilestoneDB.project_id == project_id)\
              .order_by(database.MilestoneDB.position.desc()).first()
    m = database.MilestoneDB(project_id=project_id, title=body.title.strip(),
                              description=body.description or None, position=(last.position + 1) if last else 0)
    db.add(m); db.commit(); db.refresh(m)
    return milestone_to_out(m)

@app.patch("/api/milestones/{milestone_id}", response_model=MilestoneOut)
def update_milestone(milestone_id: int, body: MilestonePatch, db: Session = Depends(database.get_db)):
    m = db.query(database.MilestoneDB).filter(database.MilestoneDB.id == milestone_id).first()
    if not m: raise HTTPException(404, "Milestone not found")
    if body.title is not None: m.title = body.title.strip()
    if body.description is not None: m.description = body.description or None
    if body.completed is not None: m.completed = body.completed
    if body.priority is not None:
        if body.priority not in VALID_PRIORITIES: raise HTTPException(422, "Invalid priority")
        m.priority = body.priority
    db.commit(); db.refresh(m)
    return milestone_to_out(m)

@app.delete("/api/milestones/{milestone_id}", status_code=204)
def delete_milestone(milestone_id: int, db: Session = Depends(database.get_db)):
    m = db.query(database.MilestoneDB).filter(database.MilestoneDB.id == milestone_id).first()
    if not m: raise HTTPException(404, "Milestone not found")
    db.delete(m); db.commit()

@app.put("/api/projects/{project_id}/milestones/reorder", status_code=204)
def reorder_milestones(project_id: int, body: ReorderBody, db: Session = Depends(database.get_db)):
    for pos, mid in enumerate(body.ids):
        db.query(database.MilestoneDB).filter(
            database.MilestoneDB.id == mid,
            database.MilestoneDB.project_id == project_id,
        ).update({"position": pos})
    db.commit()
