import json
import re
from typing import Dict, Any, List

import httpx

from core.config import settings


def _extract_json_payload(text: str) -> Dict[str, Any]:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except Exception:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            raise ValueError("Model did not return valid JSON")
        return json.loads(match.group(0))


def _normalize_test_cases(cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    output = []
    for item in cases or []:
        inp = str(item.get("input", "")).strip()
        exp = str(item.get("expected", "")).strip()
        if not inp or not exp:
            continue
        output.append({
            "input": inp,
            "expected": exp,
            "is_sample": bool(item.get("is_sample", False)),
        })
    if not output:
        output = [
            {"input": "1", "expected": "1", "is_sample": True},
            {"input": "2", "expected": "2", "is_sample": False},
        ]
    if not any(tc["is_sample"] for tc in output):
        output[0]["is_sample"] = True
    return output


async def generate_problem_with_ai(prompt: str, difficulty: str = "medium") -> Dict[str, Any]:
    if not settings.OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    system_message = (
        "You generate programming contest problems. Return ONLY JSON with keys: "
        "title, description, input_format, output_format, constraints, difficulty, "
        "time_limit_ms, memory_limit_mb, sample_input, sample_output, tags, test_cases. "
        "test_cases must be an array of {input, expected, is_sample}."
    )
    user_message = (
        f"Generate one {difficulty} coding problem based on: {prompt}. "
        "Keep description concise but complete. Include at least 4 test cases with at least 1 sample case."
    )

    payload = {
        "model": settings.OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.7,
    }

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.FRONTEND_URL,
        "X-Title": "CodeForge AI",
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]

    generated = _extract_json_payload(content)
    return {
        "title": str(generated.get("title", "Generated Problem")).strip(),
        "description": str(generated.get("description", "")).strip(),
        "input_format": str(generated.get("input_format", "")).strip(),
        "output_format": str(generated.get("output_format", "")).strip(),
        "constraints": str(generated.get("constraints", "")).strip(),
        "difficulty": str(generated.get("difficulty", difficulty or "medium")).lower(),
        "time_limit_ms": int(generated.get("time_limit_ms", 2000) or 2000),
        "memory_limit_mb": int(generated.get("memory_limit_mb", 256) or 256),
        "sample_input": str(generated.get("sample_input", "")).strip(),
        "sample_output": str(generated.get("sample_output", "")).strip(),
        "tags": [str(tag).strip() for tag in (generated.get("tags") or []) if str(tag).strip()],
        "test_cases": _normalize_test_cases(generated.get("test_cases") or []),
    }
