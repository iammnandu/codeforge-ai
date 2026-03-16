from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

from core.database import get_db
from core.dependencies import get_current_user, require_organizer
from models.submission import Submission
from models.problem import Problem, TestCase
from models.contest import ContestParticipant, Contest
from models.user import User
from schemas.submission import SubmissionCreate, SubmissionOut
from services.code_runner import run_code_against_tests

router = APIRouter()


@router.post("/", response_model=SubmissionOut, status_code=201)
async def submit_code(
    payload: SubmissionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    problem = db.query(Problem).filter(Problem.id == payload.problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    submission = Submission(
        problem_id=payload.problem_id,
        contest_id=payload.contest_id,
        candidate_id=current_user.id,
        language=payload.language,
        code=payload.code,
        status="pending",
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # Run evaluation in background
    background_tasks.add_task(
        evaluate_submission,
        submission.id,
        problem.id,
        payload.language,
        payload.code,
        payload.contest_id,
        current_user.id,
    )
    return submission


def evaluate_submission(
    submission_id: int,
    problem_id: int,
    language: str,
    code: str,
    contest_id: int,
    user_id: int,
):
    from core.database import SessionLocal
    db = SessionLocal()
    try:
        test_cases = db.query(TestCase).filter(TestCase.problem_id == problem_id).all()
        results = run_code_against_tests(code, language, test_cases)

        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        passed = sum(1 for r in results if r["passed"])
        total = len(results)

        submission.test_results = results
        submission.score = (passed / total) * 100 if total else 0
        submission.status = "accepted" if passed == total else "wrong_answer"

        # Update contest score
        if contest_id:
            participant = db.query(ContestParticipant).filter_by(
                contest_id=contest_id, user_id=user_id
            ).first()
            if participant and submission.score > participant.score:
                participant.score = submission.score

        db.commit()
    except Exception as e:
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if submission:
            submission.status = "runtime_error"
            submission.error_message = str(e)
            db.commit()
    finally:
        db.close()


@router.get("/my", response_model=List[SubmissionOut])
def my_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Submission)
        .filter(Submission.candidate_id == current_user.id)
        .order_by(Submission.submitted_at.desc())
        .limit(50)
        .all()
    )


@router.get("/{submission_id}", response_model=SubmissionOut)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if sub.candidate_id != current_user.id and current_user.role != "organizer":
        raise HTTPException(status_code=403, detail="Access denied")
    return sub


@router.put("/{submission_id}/grade", response_model=SubmissionOut)
def manual_grade_submission(
    submission_id: int,
    score: float,
    status: str = "accepted",
    db: Session = Depends(get_db),
    organizer: User = Depends(require_organizer),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if submission.contest_id:
        contest = db.query(Contest).filter(Contest.id == submission.contest_id).first()
        if not contest or contest.organizer_id != organizer.id:
            raise HTTPException(status_code=403, detail="Not allowed to grade this submission")

    submission.score = max(0.0, min(100.0, score))
    submission.status = status
    db.commit()
    db.refresh(submission)
    return submission
