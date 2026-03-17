from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from core.database import get_db
from core.dependencies import get_current_user, require_organizer
from models.problem import Problem, TestCase
from models.contest import Contest, ContestProblem, ContestParticipant
from models.submission import Submission
from models.user import User
from schemas.problem import (
    ProblemCreate,
    ProblemOut,
    ProblemDetail,
    TestCaseCreate,
    ProblemGenerateIn,
    ProblemGenerateOut,
)
from services.problem_generation_service import generate_problem_with_ai

router = APIRouter()


@router.post("/generate-ai", response_model=ProblemGenerateOut, status_code=200)
async def generate_problem_ai(
    payload: ProblemGenerateIn,
    organizer: User = Depends(require_organizer),
):
    try:
        return await generate_problem_with_ai(payload.prompt, payload.difficulty)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"AI generation failed: {str(exc)}")


@router.post("/", response_model=ProblemOut, status_code=201)
def create_problem(
    payload: ProblemCreate,
    db: Session = Depends(get_db),
    organizer: User = Depends(require_organizer),
):
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", payload.title.lower()).strip("-")
    # Ensure unique slug
    existing = db.query(Problem).filter(Problem.slug == slug).first()
    if existing:
        slug = f"{slug}-{organizer.id}"

    problem = Problem(
        title=payload.title,
        slug=slug,
        description=payload.description,
        input_format=payload.input_format,
        output_format=payload.output_format,
        constraints=payload.constraints,
        difficulty=payload.difficulty,
        time_limit_ms=payload.time_limit_ms,
        memory_limit_mb=payload.memory_limit_mb,
        sample_input=payload.sample_input,
        sample_output=payload.sample_output,
        tags=payload.tags,
        is_public=payload.is_public,
        created_by=organizer.id,
    )
    db.add(problem)
    db.flush()

    for tc in payload.test_cases:
        test_case = TestCase(
            problem_id=problem.id,
            input=tc.input,
            expected=tc.expected,
            is_sample=tc.is_sample,
            is_hidden=not tc.is_sample,
        )
        db.add(test_case)

    db.commit()
    db.refresh(problem)
    return problem


@router.get("/", response_model=List[ProblemOut])
def list_problems(
    difficulty: str = None,
    contest_id: int = None,
    include_private: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if contest_id is not None:
        contest = db.query(Contest).filter(Contest.id == contest_id).first()
        if not contest:
            raise HTTPException(status_code=404, detail="Contest not found")

        participant = db.query(ContestParticipant).filter_by(
            contest_id=contest_id,
            user_id=current_user.id,
        ).first()
        if current_user.role != "organizer" and not participant:
            raise HTTPException(status_code=403, detail="Not enrolled in this contest")

        q = (
            db.query(Problem)
            .join(ContestProblem, ContestProblem.problem_id == Problem.id)
            .filter(ContestProblem.contest_id == contest_id)
            .order_by(ContestProblem.order.asc(), Problem.id.asc())
        )
    elif current_user.role == "organizer":
        q = db.query(Problem).filter(Problem.created_by == current_user.id)
        if not include_private:
            q = q.filter(Problem.is_public == True)
    else:
        q = db.query(Problem).filter(Problem.is_public == True)

    if difficulty:
        q = q.filter(Problem.difficulty == difficulty)

    if contest_id is not None:
        return q.all()
    return q.order_by(Problem.id.desc()).all()


@router.get("/{problem_id}", response_model=ProblemDetail)
def get_problem(
    problem_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem


@router.put("/{problem_id}/visibility", response_model=ProblemOut)
def update_problem_visibility(
    problem_id: int,
    is_public: bool,
    db: Session = Depends(get_db),
    organizer: User = Depends(require_organizer),
):
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    if problem.created_by != organizer.id:
        raise HTTPException(status_code=403, detail="Not allowed to update this problem")

    problem.is_public = is_public
    db.commit()
    db.refresh(problem)
    return problem


@router.delete("/{problem_id}", status_code=200)
def delete_problem(
    problem_id: int,
    db: Session = Depends(get_db),
    organizer: User = Depends(require_organizer),
):
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    if problem.created_by != organizer.id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this problem")

    linked_contests = db.query(ContestProblem).filter(ContestProblem.problem_id == problem_id).count()
    linked_submissions = db.query(Submission).filter(Submission.problem_id == problem_id).count()
    if linked_contests > 0 or linked_submissions > 0:
        raise HTTPException(
            status_code=400,
            detail="Problem cannot be deleted because it is used in contests or submissions",
        )

    db.delete(problem)
    db.commit()
    return {"message": "Problem deleted"}
