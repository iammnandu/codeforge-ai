"""
Seed script — populates the database with sample data for testing.

Usage:
  cd backend
  source venv/bin/activate
  python seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from core.database import SessionLocal, engine, Base
from core.security import get_password_hash
from models.user import User
from models.contest import Contest, ContestParticipant, ContestProblem
from models.problem import Problem, TestCase
from models.submission import Submission
from models.monitoring import MonitoringSession, MonitoringEvent
from models.contest_attempt import ContestAttempt
from datetime import datetime, timedelta
import json

Base.metadata.create_all(bind=engine)
db = SessionLocal()

print("🌱 Seeding database…")

# ── Users ────────────────────────────────────────────────────────────────────
organizer = db.query(User).filter_by(email="org@codeforgeai.com").first()
if not organizer:
    organizer = User(
        email="org@codeforgeai.com", username="organizer1", full_name="Dr. Arjun Sharma",
        hashed_password=get_password_hash("password123"),
        role="organizer", is_active=True, is_verified=True,
    )
    db.add(organizer)

candidate = db.query(User).filter_by(email="cand@codeforgeai.com").first()
if not candidate:
    candidate = User(
        email="cand@codeforgeai.com", username="alice_dev", full_name="Alice Johnson",
        hashed_password=get_password_hash("password123"),
        role="candidate", is_active=True, is_verified=True,
    )
    db.add(candidate)

db.flush()
print("  ✓ Users created")

# ── Problems ─────────────────────────────────────────────────────────────────
problems_data = [
    {
        "title": "Two Sum",
        "difficulty": "easy",
        "description": "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
        "input_format": "First line: n (array size)\nSecond line: n space-separated integers\nThird line: target integer",
        "output_format": "Two space-separated indices (0-indexed)",
        "constraints": "2 ≤ n ≤ 10^4\n-10^9 ≤ nums[i] ≤ 10^9\n-10^9 ≤ target ≤ 10^9",
        "sample_input": "4\n2 7 11 15\n9",
        "sample_output": "0 1",
        "tags": ["array", "hash-table"],
        "test_cases": [
            ("4\n2 7 11 15\n9", "0 1", True),
            ("3\n3 2 4\n6", "1 2", True),
            ("2\n3 3\n6", "0 1", False),
            ("5\n1 2 3 4 5\n9", "3 4", False),
        ],
    },
    {
        "title": "Reverse a Linked List",
        "difficulty": "easy",
        "description": "Given the head of a singly linked list represented as a space-separated sequence of integers, reverse it and print the reversed list.",
        "input_format": "First line: n (number of nodes)\nSecond line: n space-separated integers",
        "output_format": "Space-separated integers of the reversed list",
        "constraints": "0 ≤ n ≤ 5000",
        "sample_input": "5\n1 2 3 4 5",
        "sample_output": "5 4 3 2 1",
        "tags": ["linked-list", "recursion"],
        "test_cases": [
            ("5\n1 2 3 4 5", "5 4 3 2 1", True),
            ("2\n1 2", "2 1", True),
            ("1\n0", "0", False),
            ("6\n10 20 30 40 50 60", "60 50 40 30 20 10", False),
        ],
    },
    {
        "title": "Longest Substring Without Repeating Characters",
        "difficulty": "medium",
        "description": "Given a string `s`, find the length of the longest substring without repeating characters.",
        "input_format": "A single string s",
        "output_format": "A single integer — the length of the longest substring",
        "constraints": "0 ≤ s.length ≤ 5 × 10^4\ns consists of English letters, digits, symbols and spaces",
        "sample_input": "abcabcbb",
        "sample_output": "3",
        "tags": ["string", "sliding-window", "hash-table"],
        "test_cases": [
            ("abcabcbb", "3", True),
            ("bbbbb", "1", True),
            ("pwwkew", "3", False),
            ("", "0", False),
            ("dvdf", "3", False),
        ],
    },
    {
        "title": "Merge Intervals",
        "difficulty": "medium",
        "description": "Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals and return an array of the non-overlapping intervals.",
        "input_format": "First line: n (number of intervals)\nNext n lines: two space-separated integers start end",
        "output_format": "Each merged interval on its own line as two space-separated integers",
        "constraints": "1 ≤ n ≤ 10^4\n0 ≤ start ≤ end ≤ 10^4",
        "sample_input": "4\n1 3\n2 6\n8 10\n15 18",
        "sample_output": "1 6\n8 10\n15 18",
        "tags": ["array", "sorting"],
        "test_cases": [
            ("4\n1 3\n2 6\n8 10\n15 18", "1 6\n8 10\n15 18", True),
            ("2\n1 4\n4 5", "1 5", True),
            ("1\n1 1", "1 1", False),
        ],
    },
    {
        "title": "Maximum Subarray",
        "difficulty": "medium",
        "description": "Given an integer array nums, find the subarray with the largest sum and return its sum. (Kadane's Algorithm)",
        "input_format": "First line: n\nSecond line: n space-separated integers",
        "output_format": "A single integer — the maximum subarray sum",
        "constraints": "1 ≤ n ≤ 10^5\n-10^4 ≤ nums[i] ≤ 10^4",
        "sample_input": "9\n-2 1 -3 4 -1 2 1 -5 4",
        "sample_output": "6",
        "tags": ["array", "dynamic-programming", "divide-and-conquer"],
        "test_cases": [
            ("9\n-2 1 -3 4 -1 2 1 -5 4", "6", True),
            ("1\n1", "1", True),
            ("5\n5 4 -1 7 8", "23", False),
        ],
    },
    {
        "title": "Palindrome String",
        "difficulty": "easy",
        "description": "Given a string s, determine if it is a palindrome. Print true if palindrome else false.",
        "input_format": "A single string s",
        "output_format": "true or false",
        "constraints": "1 ≤ |s| ≤ 10^5",
        "sample_input": "madam",
        "sample_output": "true",
        "tags": ["string", "two-pointers"],
        "test_cases": [
            ("madam", "true", True),
            ("racecar", "true", True),
            ("coding", "false", False),
            ("abba", "true", False),
        ],
    },
    {
        "title": "FizzBuzz",
        "difficulty": "easy",
        "description": "Given an integer n, print numbers from 1 to n. For multiples of 3 print Fizz, for multiples of 5 print Buzz, and for both print FizzBuzz.",
        "input_format": "Single integer n",
        "output_format": "n lines as per FizzBuzz rules",
        "constraints": "1 ≤ n ≤ 10^4",
        "sample_input": "5",
        "sample_output": "1\n2\nFizz\n4\nBuzz",
        "tags": ["math", "simulation"],
        "test_cases": [
            ("5", "1\n2\nFizz\n4\nBuzz", True),
            ("3", "1\n2\nFizz", True),
            ("15", "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz", False),
        ],
    },
    {
        "title": "Factorial",
        "difficulty": "easy",
        "description": "Given a non-negative integer n, print n!.",
        "input_format": "Single integer n",
        "output_format": "Single integer factorial of n",
        "constraints": "0 ≤ n ≤ 12",
        "sample_input": "5",
        "sample_output": "120",
        "tags": ["math", "recursion"],
        "test_cases": [
            ("0", "1", True),
            ("5", "120", True),
            ("7", "5040", False),
        ],
    },
    {
        "title": "Count Vowels",
        "difficulty": "easy",
        "description": "Given a lowercase string s, count how many vowels (a, e, i, o, u) are present.",
        "input_format": "Single lowercase string s",
        "output_format": "Single integer count of vowels",
        "constraints": "1 ≤ |s| ≤ 10^5",
        "sample_input": "education",
        "sample_output": "5",
        "tags": ["string"],
        "test_cases": [
            ("education", "5", True),
            ("rhythm", "0", True),
            ("programming", "3", False),
        ],
    },
    {
        "title": "N-Queens",
        "difficulty": "hard",
        "description": "The n-queens puzzle is the problem of placing n queens on an n×n chessboard such that no two queens attack each other. Given an integer n, return the number of distinct solutions.",
        "input_format": "A single integer n",
        "output_format": "A single integer — the number of solutions",
        "constraints": "1 ≤ n ≤ 9",
        "sample_input": "4",
        "sample_output": "2",
        "tags": ["backtracking"],
        "test_cases": [
            ("4", "2", True),
            ("1", "1", True),
            ("8", "92", False),
            ("6", "4", False),
        ],
    },
]

created_problems = []
for pd in problems_data:
    existing = db.query(Problem).filter_by(title=pd["title"]).first()
    if existing:
        created_problems.append(existing)
        continue

    import re
    slug_base = re.sub(r"[^a-z0-9]+", "-", pd["title"].lower()).strip("-")
    slug = slug_base
    suffix = 1
    while db.query(Problem).filter_by(slug=slug).first():
        suffix += 1
        slug = f"{slug_base}-{suffix}"
    p = Problem(
        title=pd["title"], slug=slug, description=pd["description"],
        input_format=pd["input_format"], output_format=pd["output_format"],
        constraints=pd["constraints"], difficulty=pd["difficulty"],
        sample_input=pd["sample_input"], sample_output=pd["sample_output"],
        tags=pd["tags"], created_by=organizer.id, is_public=True,
    )
    db.add(p)
    db.flush()

    for inp, exp, is_sample in pd["test_cases"]:
        db.add(TestCase(problem_id=p.id, input=inp, expected=exp,
                        is_sample=is_sample, is_hidden=not is_sample))
    created_problems.append(p)

db.flush()
print(f"  ✓ {len(problems_data)} problems created")

# ── Contest ───────────────────────────────────────────────────────────────────
contest = db.query(Contest).filter_by(title="Sample Programming Contest #1").first()
if not contest:
    now = datetime.utcnow()
    contest = Contest(
        title="Sample Programming Contest #1",
        description="A practice contest with 3 problems. AI proctoring is enabled.",
        organizer_id=organizer.id,
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=2),
        duration_minutes=180,
        allowed_languages=["python", "cpp", "java", "javascript"],
        is_published=True,
        proctoring_enabled=True,
    )
    db.add(contest)
    db.flush()

    # Add first 3 problems to contest
    for i, p in enumerate(created_problems[:3]):
        db.add(ContestProblem(contest_id=contest.id, problem_id=p.id, order=i, points=100))

    # Register candidate
    db.add(ContestParticipant(contest_id=contest.id, user_id=candidate.id, score=0))

db.commit()
print("  ✓ Sample contest created")

print(f"""
✅ Database seeded successfully!

Test accounts:
    Organizer: org@codeforgeai.com   / password123
    Candidate: cand@codeforgeai.com  / password123

Contest code: {contest.contest_code}
""")

db.close()
