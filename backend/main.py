from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.database import engine, Base
from routers import auth, contests, problems, submissions, monitoring, users

# Create all DB tables on startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="CodeForge AI API",
    description="AI-Powered Secure Coding Examination Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Update for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,        prefix="/api/auth",        tags=["Authentication"])
app.include_router(users.router,       prefix="/api/users",       tags=["Users"])
app.include_router(contests.router,    prefix="/api/contests",    tags=["Contests"])
app.include_router(problems.router,    prefix="/api/problems",    tags=["Problems"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["Submissions"])
app.include_router(monitoring.router,  prefix="/api/monitoring",  tags=["Monitoring"])

@app.get("/")
def root():
    return {"message": "CodeForge AI API is running", "docs": "/docs"}
