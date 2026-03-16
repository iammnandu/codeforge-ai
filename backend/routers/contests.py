from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from core.database import get_db
from core.dependencies import get_current_user, require_organizer, require_candidate
from models.contest import Contest, ContestParticipant, ContestProblem
from models.problem import Problem, TestCase
from models.submission import Submission
from models.contest_attempt import ContestAttempt
from models.monitoring import MonitoringSession, MonitoringEvent
from models.user import User
from schemas.contest import (
    ContestCreate, ContestOut, ContestDetail,
    JoinContest, ParticipantOut
)
from services.email_service import send_contest_invite

router = APIRouter()


def _utc_now_naive():
    return datetime.utcnow()


def _as_naive(dt: datetime):
    if dt is None:
        return None
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


def _compute_and_store_results(db: Session, contest_id: int):
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    points_map = {
        cp.problem_id: cp.points
        for cp in db.query(ContestProblem).filter(ContestProblem.contest_id == contest_id).all()
    }

    participants = db.query(ContestParticipant).filter(ContestParticipant.contest_id == contest_id).all()

    rows = []
    for participant in participants:
        submissions = (
            db.query(Submission)
            .filter(
                Submission.contest_id == contest_id,
                Submission.candidate_id == participant.user_id,
            )
            .all()
        )

        best_by_problem = {}
        for sub in submissions:
            existing = best_by_problem.get(sub.problem_id)
            if not existing or (sub.score or 0) > (existing.score or 0):
                best_by_problem[sub.problem_id] = sub

        total_score = 0.0
        solved_count = 0
        for problem_id, best in best_by_problem.items():
            if (best.score or 0) > 0:
                solved_count += 1
            points = points_map.get(problem_id, 100)
            total_score += points * ((best.score or 0) / 100.0)

        participant.score = int(round(total_score))
        rows.append({
            "user_id": participant.user_id,
            "score": participant.score,
            "solved": solved_count,
            "joined_at": participant.joined_at,
        })

    rows.sort(key=lambda row: (-row["score"], row["joined_at"]))

    rank_by_user = {}
    for index, row in enumerate(rows, start=1):
        rank_by_user[row["user_id"]] = index

    for participant in participants:
        participant.rank = rank_by_user.get(participant.user_id)

    db.commit()
    return rows


def _get_or_create_attempt(db: Session, contest_id: int, user_id: int) -> ContestAttempt:
    attempt = db.query(ContestAttempt).filter_by(contest_id=contest_id, user_id=user_id).first()
    if not attempt:
        attempt = ContestAttempt(contest_id=contest_id, user_id=user_id, is_submitted=False)
        db.add(attempt)
        db.flush()
    return attempt


@router.post("/", response_model=ContestOut, status_code=201)
def create_contest(
    payload: ContestCreate,
    db: Session = Depends(get_db),
    organizer: User = Depends(require_organizer),
):
    contest = Contest(
        title=payload.title,
        description=payload.description,
        organizer_id=organizer.id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        duration_minutes=payload.duration_minutes,
        allowed_languages=payload.allowed_languages,
        proctoring_enabled=payload.proctoring_enabled,
    )
    db.add(contest)
    db.commit()
    db.refresh(contest)
    return contest


@router.get("/", response_model=List[ContestOut])
def list_contests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "organizer":
        return db.query(Contest).filter(Contest.organizer_id == current_user.id).all()
    return db.query(Contest).filter(Contest.is_published == True).all()


@router.get("/{contest_id}", response_model=ContestDetail)
def get_contest(
    contest_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")
    return contest


@router.post("/join", status_code=200)
def join_contest(
    payload: JoinContest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Join via contest code."""
    contest = db.query(Contest).filter(Contest.contest_code == payload.contest_code).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Invalid contest code")
    if not contest.is_published:
        raise HTTPException(status_code=403, detail="Contest is not open yet")

    already = db.query(ContestParticipant).filter_by(
        contest_id=contest.id, user_id=current_user.id
    ).first()
    if already:
        return {"message": "Already joined", "contest_id": contest.id}

    participant = ContestParticipant(contest_id=contest.id, user_id=current_user.id)
    db.add(participant)
    db.commit()
    return {"message": "Joined successfully", "contest_id": contest.id}


@router.post("/{contest_id}/invite")
async def invite_participants(
    contest_id: int,
    emails: List[str],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    organizer: User = Depends(require_organizer),
):
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")
    if contest.organizer_id != organizer.id:
        raise HTTPException(status_code=403, detail="Not your contest")

    for email in emails:
        background_tasks.add_task(send_contest_invite, email, contest)

    return {"message": f"Invitations sent to {len(emails)} participants"}


@router.post("/{contest_id}/problems/{problem_id}", status_code=201)
def add_problem_to_contest(
    contest_id: int,
    problem_id: int,
    points: int = 100,
    order: int = 0,
    db: Session = Depends(get_db),
    organizer: User = Depends(require_organizer),
):
    contest = db.query(Contest).filter(
        Contest.id == contest_id,
        Contest.organizer_id == organizer.id,
    ).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    existing = db.query(ContestProblem).filter_by(
        contest_id=contest_id,
        problem_id=problem_id,
    ).first()
    if existing:
        return {"message": "Problem already added"}

    if order <= 0:
        max_order = db.query(ContestProblem).filter(ContestProblem.contest_id == contest_id).count()
        order = max_order + 1

    item = ContestProblem(
        contest_id=contest_id,
        problem_id=problem_id,
        points=max(1, points),
        order=order,
    )
    db.add(item)
    db.commit()
    return {"message": "Problem added to contest", "contest_id": contest_id, "problem_id": problem_id}


@router.post("/{contest_id}/problems/bootstrap-basic", status_code=201)
def bootstrap_basic_problems(
    contest_id: int,
    db: Session = Depends(get_db),
    organizer: User = Depends(require_organizer),
):
    contest = db.query(Contest).filter(
        Contest.id == contest_id,
        Contest.organizer_id == organizer.id,
    ).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    templates = [
        {
            "title": "Sum of Two Numbers",
            "slug": f"sum-of-two-numbers-{organizer.id}",
            "description": "Read two integers a and b. Print their sum.",
            "difficulty": "easy",
            "sample_input": "2 3",
            "sample_output": "5",
            "tests": [
                ("2 3", "5", True),
                ("10 20", "30", False),
            ],
        },
        {
            "title": "Maximum of Three",
            "slug": f"maximum-of-three-{organizer.id}",
            "description": "Given three integers, print the largest value.",
            "difficulty": "easy",
            "sample_input": "5 9 2",
            "sample_output": "9",
            "tests": [
                ("5 9 2", "9", True),
                ("-1 -5 -3", "-1", False),
            ],
        },
        {
            "title": "Count Even Numbers",
            "slug": f"count-even-numbers-{organizer.id}",
            "description": "First line contains n. Second line has n integers. Print how many are even.",
            "difficulty": "easy",
            "sample_input": "5\n1 2 3 4 6",
            "sample_output": "3",
            "tests": [
                ("5\n1 2 3 4 6", "3", True),
                ("4\n1 3 5 7", "0", False),
            ],
        },
    ]

    added = 0
    for index, item in enumerate(templates, start=1):
        problem = db.query(Problem).filter(Problem.slug == item["slug"]).first()
        if not problem:
            problem = Problem(
                title=item["title"],
                slug=item["slug"],
                description=item["description"],
                input_format="Problem specific",
                output_format="Single value",
                constraints="1 <= n <= 10^5",
                difficulty=item["difficulty"],
                is_public=False,
                created_by=organizer.id,
                sample_input=item["sample_input"],
                sample_output=item["sample_output"],
                tags=["basic", "contest"],
            )
            db.add(problem)
            db.flush()

            for order, (inp, exp, is_sample) in enumerate(item["tests"], start=1):
                db.add(TestCase(
                    problem_id=problem.id,
                    input=inp,
                    expected=exp,
                    is_sample=is_sample,
                    is_hidden=not is_sample,
                    order=order,
                ))

        existing_link = db.query(ContestProblem).filter_by(
            contest_id=contest_id,
            problem_id=problem.id,
        ).first()
        if not existing_link:
            db.add(ContestProblem(
                contest_id=contest_id,
                problem_id=problem.id,
                order=index,
                points=100,
            ))
            added += 1

    db.commit()
    return {"message": "Basic problems added", "added_count": added}


@router.get("/{contest_id}/leaderboard", response_model=List[ParticipantOut])
def get_leaderboard(contest_id: int, db: Session = Depends(get_db)):
    _compute_and_store_results(db, contest_id)
    participants = (
        db.query(ContestParticipant)
        .filter(ContestParticipant.contest_id == contest_id)
        .order_by(ContestParticipant.rank.asc())
        .all()
    )
    return participants


@router.post("/{contest_id}/finish", status_code=200)
def finish_contest_for_candidate(
    contest_id: int,
    db: Session = Depends(get_db),
    candidate: User = Depends(require_candidate),
):
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    participant = db.query(ContestParticipant).filter_by(
        contest_id=contest_id,
        user_id=candidate.id,
    ).first()
    if not participant:
        raise HTTPException(status_code=403, detail="You are not a participant of this contest")

    attempt = _get_or_create_attempt(db, contest_id, candidate.id)
    attempt.is_submitted = True
    attempt.submitted_at = _utc_now_naive()
    _compute_and_store_results(db, contest_id)
    db.refresh(participant)
    return {
        "message": "Contest submitted successfully",
        "contest_id": contest_id,
        "score": participant.score,
        "rank": participant.rank,
        "redirect": f"/candidate/contest/{contest_id}/results",
    }


@router.put("/{contest_id}/end", status_code=200)
def end_contest_manually(
    contest_id: int,
    db: Session = Depends(get_db),
    organizer: User = Depends(require_organizer),
):
    contest = db.query(Contest).filter(
        Contest.id == contest_id,
        Contest.organizer_id == organizer.id,
    ).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    contest.end_time = _utc_now_naive()
    contest.is_active = False
    _compute_and_store_results(db, contest_id)
    db.commit()
    return {"message": "Contest ended and results finalized"}


@router.get("/{contest_id}/results", status_code=200)
def contest_results(
    contest_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    if current_user.role != "organizer" and _utc_now_naive() < _as_naive(contest.end_time):
        raise HTTPException(status_code=403, detail="Results available after contest ends")

    rows = _compute_and_store_results(db, contest_id)
    participants = (
        db.query(ContestParticipant, User)
        .join(User, User.id == ContestParticipant.user_id)
        .filter(ContestParticipant.contest_id == contest_id)
        .order_by(ContestParticipant.rank.asc())
        .all()
    )
    by_user = {row["user_id"]: row for row in rows}

    return [
        {
            "user_id": participant.user_id,
            "username": user.username,
            "score": participant.score,
            "rank": participant.rank,
            "joined_at": participant.joined_at,
            "solved": by_user.get(participant.user_id, {}).get("solved", 0),
        }
        for participant, user in participants
    ]


@router.get("/{contest_id}/results/me", status_code=200)
def my_contest_result(
    contest_id: int,
    db: Session = Depends(get_db),
    candidate: User = Depends(require_candidate),
):
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    participant = db.query(ContestParticipant).filter_by(
        contest_id=contest_id,
        user_id=candidate.id,
    ).first()
    if not participant:
        raise HTTPException(status_code=403, detail="You are not a participant of this contest")

    attempt = db.query(ContestAttempt).filter_by(contest_id=contest_id, user_id=candidate.id).first()
    contest_ended = _utc_now_naive() >= _as_naive(contest.end_time)
    if not contest_ended:
        raise HTTPException(status_code=403, detail="Results available only after contest ends")

    rows = _compute_and_store_results(db, contest_id)
    by_user = {row["user_id"]: row for row in rows}
    mine = by_user.get(candidate.id, {"solved": 0})

    submissions = (
        db.query(Submission)
        .filter(
            Submission.contest_id == contest_id,
            Submission.candidate_id == candidate.id,
        )
        .order_by(Submission.submitted_at.desc())
        .all()
    )

    best_by_problem = {}
    for sub in submissions:
        current = best_by_problem.get(sub.problem_id)
        if not current or (sub.score or 0) > (current.score or 0):
            best_by_problem[sub.problem_id] = sub

    problem_rows = []
    points_map = {
        cp.problem_id: cp.points
        for cp in db.query(ContestProblem).filter(ContestProblem.contest_id == contest_id).all()
    }
    for problem_id, sub in best_by_problem.items():
        problem_rows.append({
            "problem_id": problem_id,
            "status": sub.status,
            "score": sub.score,
            "points": points_map.get(problem_id, 100),
            "submitted_at": sub.submitted_at,
        })

    problem_rows.sort(key=lambda row: row["problem_id"])
    return {
        "contest_id": contest_id,
        "score": participant.score,
        "rank": participant.rank,
        "solved": mine.get("solved", 0),
        "total_participants": len(rows),
        "problems": problem_rows,
        "ended": contest_ended,
        "submitted": bool(attempt and attempt.is_submitted),
        "feedback_rating": attempt.feedback_rating if attempt else None,
        "feedback_text": attempt.feedback_text if attempt else None,
    }


@router.post("/{contest_id}/feedback", status_code=200)
def submit_feedback(
    contest_id: int,
    rating: int,
    feedback_text: str = "",
    db: Session = Depends(get_db),
    candidate: User = Depends(require_candidate),
):
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    participant = db.query(ContestParticipant).filter_by(
        contest_id=contest_id,
        user_id=candidate.id,
    ).first()
    if not participant:
        raise HTTPException(status_code=403, detail="You are not a participant of this contest")

    attempt = _get_or_create_attempt(db, contest_id, candidate.id)
    if not attempt.is_submitted and _utc_now_naive() < _as_naive(contest.end_time):
        raise HTTPException(status_code=403, detail="Submit contest before feedback")

    attempt.feedback_rating = max(1, min(5, int(rating)))
    attempt.feedback_text = (feedback_text or "").strip()[:1000]
    db.commit()
    return {"message": "Feedback submitted"}


@router.get("/results/my", status_code=200)
def my_results_dashboard(
    db: Session = Depends(get_db),
    candidate: User = Depends(require_candidate),
):
    attempts = (
        db.query(ContestAttempt)
        .filter(ContestAttempt.user_id == candidate.id)
        .order_by(ContestAttempt.created_at.desc())
        .all()
    )

    rows = []
    for attempt in attempts:
        contest = db.query(Contest).filter(Contest.id == attempt.contest_id).first()
        if not contest:
            continue
        contest_ended = _utc_now_naive() >= _as_naive(contest.end_time)
        if not contest_ended:
            continue

        participant = db.query(ContestParticipant).filter_by(
            contest_id=attempt.contest_id,
            user_id=candidate.id,
        ).first()
        rows.append({
            "contest_id": contest.id,
            "title": contest.title,
            "score": participant.score if participant else 0,
            "rank": participant.rank if participant else None,
            "submitted_at": attempt.submitted_at,
            "feedback_rating": attempt.feedback_rating,
        })

    return rows


@router.put("/{contest_id}/results/mark", status_code=200)
def apply_manual_marks(
    contest_id: int,
    user_id: int,
    marks: int,
    db: Session = Depends(get_db),
    organizer: User = Depends(require_organizer),
):
    contest = db.query(Contest).filter(
        Contest.id == contest_id,
        Contest.organizer_id == organizer.id,
    ).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    participant = db.query(ContestParticipant).filter_by(
        contest_id=contest_id,
        user_id=user_id,
    ).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    participant.score = max(0, int(participant.score or 0) + int(marks))

    participants = db.query(ContestParticipant).filter(ContestParticipant.contest_id == contest_id).all()
    ranked = sorted(participants, key=lambda p: (-(p.score or 0), p.joined_at))
    for idx, row in enumerate(ranked, start=1):
        row.rank = idx

    db.commit()
    return {"message": "Manual marks applied", "user_id": user_id, "score": participant.score, "rank": participant.rank}


@router.get("/{contest_id}/candidates/{user_id}/detail", status_code=200)
def candidate_detail_report(
    contest_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    organizer: User = Depends(require_organizer),
):
    contest = db.query(Contest).filter(
        Contest.id == contest_id,
        Contest.organizer_id == organizer.id,
    ).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    participant = db.query(ContestParticipant).filter_by(
        contest_id=contest_id,
        user_id=user_id,
    ).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Candidate not found in this contest")

    candidate = db.query(User).filter(User.id == user_id).first()

    contest_problem_rows = db.query(ContestProblem, Problem).join(
        Problem, Problem.id == ContestProblem.problem_id
    ).filter(ContestProblem.contest_id == contest_id).all()
    points_map = {cp.problem_id: cp.points for cp, _ in contest_problem_rows}
    title_map = {cp.problem_id: pr.title for cp, pr in contest_problem_rows}

    submissions = (
        db.query(Submission)
        .filter(
            Submission.contest_id == contest_id,
            Submission.candidate_id == user_id,
        )
        .order_by(Submission.submitted_at.desc())
        .all()
    )

    best_by_problem = {}
    detailed_submissions = []
    for submission in submissions:
        current_best = best_by_problem.get(submission.problem_id)
        if not current_best or (submission.score or 0) > (current_best.score or 0):
            best_by_problem[submission.problem_id] = submission

        tests = submission.test_results or []
        passed_tests = sum(1 for test in tests if test.get("passed"))
        detailed_submissions.append({
            "submission_id": submission.id,
            "problem_id": submission.problem_id,
            "problem_title": title_map.get(submission.problem_id, f"Problem #{submission.problem_id}"),
            "language": submission.language,
            "status": submission.status,
            "score": submission.score,
            "submitted_at": submission.submitted_at,
            "code": submission.code,
            "test_results": tests,
            "tests_passed": passed_tests,
            "tests_total": len(tests),
            "points": points_map.get(submission.problem_id, 100),
        })

    problem_summary = []
    solved = 0
    for problem_id, submission in best_by_problem.items():
        problem_points = points_map.get(problem_id, 100)
        earned = int(round(problem_points * ((submission.score or 0) / 100.0)))
        if (submission.score or 0) > 0:
            solved += 1
        problem_summary.append({
            "problem_id": problem_id,
            "problem_title": title_map.get(problem_id, f"Problem #{problem_id}"),
            "best_submission_id": submission.id,
            "status": submission.status,
            "score": submission.score,
            "points": problem_points,
            "earned_points": earned,
        })

    problem_summary.sort(key=lambda row: row["problem_id"])

    monitoring_sessions = (
        db.query(MonitoringSession)
        .filter(
            MonitoringSession.contest_id == contest_id,
            MonitoringSession.user_id == user_id,
        )
        .order_by(MonitoringSession.started_at.desc())
        .all()
    )

    session_ids = [session.id for session in monitoring_sessions]
    monitoring_events = []
    if session_ids:
        events = (
            db.query(MonitoringEvent)
            .filter(MonitoringEvent.session_id.in_(session_ids))
            .order_by(MonitoringEvent.timestamp.desc())
            .all()
        )
        for event in events:
            monitoring_events.append({
                "id": event.id,
                "session_id": event.session_id,
                "event_type": event.event_type,
                "severity": event.severity,
                "confidence": event.confidence,
                "score_delta": event.score_delta,
                "details": event.details,
                "timestamp": event.timestamp,
            })

    critical_count = sum(1 for event in monitoring_events if event["severity"] == "critical")
    high_count = sum(1 for event in monitoring_events if event["severity"] == "high")
    actions = []
    if high_count > 0:
        actions.append("Warning issued")
    if critical_count > 0:
        actions.append("Contest paused for malpractice")
    if critical_count >= 2 or any(session.is_flagged for session in monitoring_sessions):
        actions.append("Candidate flagged/disqualified")

    return {
        "contest_id": contest_id,
        "candidate": {
            "user_id": user_id,
            "username": candidate.username if candidate else None,
            "email": candidate.email if candidate else None,
        },
        "result": {
            "rank": participant.rank,
            "score": participant.score,
            "solved": solved,
            "joined_at": participant.joined_at,
        },
        "problem_summary": problem_summary,
        "submissions": detailed_submissions,
        "monitoring": {
            "session_count": len(monitoring_sessions),
            "latest_suspicion_score": monitoring_sessions[0].suspicion_score if monitoring_sessions else 0,
            "is_flagged": any(session.is_flagged for session in monitoring_sessions),
            "actions": actions,
            "events": monitoring_events,
        },
    }


@router.put("/{contest_id}/publish")
def publish_contest(
    contest_id: int,
    db: Session = Depends(get_db),
    organizer: User = Depends(require_organizer),
):
    contest = db.query(Contest).filter(Contest.id == contest_id, Contest.organizer_id == organizer.id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")
    contest.is_published = True
    db.commit()
    return {"message": "Contest published"}
