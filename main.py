from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import database

database.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Project Organizer")
app.mount("/static", StaticFiles(directory="static"), name="static")

VALID_STATUSES = {"idea", "in_progress", "completed", "paused"}


class ProjectIn(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "idea"
    tags: List[str] = []


class ProjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: str
    tags: List[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


def db_to_out(p: database.ProjectDB) -> ProjectOut:
    tags = [t.strip() for t in p.tags.split(",") if t.strip()] if p.tags else []
    return ProjectOut(
        id=p.id,
        name=p.name,
        description=p.description,
        status=p.status,
        tags=tags,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


@app.get("/")
def root():
    return FileResponse("static/index.html")


@app.get("/api/projects", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(database.get_db)):
    projects = (
        db.query(database.ProjectDB)
        .order_by(database.ProjectDB.created_at.desc())
        .all()
    )
    return [db_to_out(p) for p in projects]


@app.post("/api/projects", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectIn, db: Session = Depends(database.get_db)):
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid status")
    p = database.ProjectDB(
        name=body.name.strip(),
        description=body.description or None,
        status=body.status,
        tags=",".join(t.strip() for t in body.tags if t.strip()),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return db_to_out(p)


@app.put("/api/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, body: ProjectIn, db: Session = Depends(database.get_db)):
    p = db.query(database.ProjectDB).filter(database.ProjectDB.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid status")
    p.name = body.name.strip()
    p.description = body.description or None
    p.status = body.status
    p.tags = ",".join(t.strip() for t in body.tags if t.strip())
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return db_to_out(p)


@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(database.get_db)):
    p = db.query(database.ProjectDB).filter(database.ProjectDB.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(p)
    db.commit()
