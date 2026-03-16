"""
Secure sandboxed code execution engine.
Runs candidate code against test cases using subprocess with strict limits.
No Docker required — uses OS-level process isolation + timeout + resource caps.
"""
import subprocess
import tempfile
import os
import sys
import time
import resource
from typing import List
from dataclasses import dataclass

LANGUAGE_CONFIG = {
    "python": {
        "extension": ".py",
        "compile_cmd": None,
        "run_cmd": [sys.executable, "{file}"],
    },
    "cpp": {
        "extension": ".cpp",
        "compile_cmd": ["g++", "-O2", "-o", "{binary}", "{file}"],
        "run_cmd": ["{binary}"],
    },
    "java": {
        "extension": ".java",
        "compile_cmd": ["javac", "{file}"],
        "run_cmd": ["java", "-cp", "{dir}", "Main"],
    },
    "javascript": {
        "extension": ".js",
        "compile_cmd": None,
        "run_cmd": ["node", "{file}"],
    },
}


def run_code_against_tests(code: str, language: str, test_cases, time_limit_ms: int = 2000) -> List[dict]:
    """
    Execute candidate code against every test case.
    Returns a list of result dicts per test case.
    """
    config = LANGUAGE_CONFIG.get(language)
    if not config:
        return [{"passed": False, "error": f"Unsupported language: {language}"}]

    with tempfile.TemporaryDirectory() as tmpdir:
        ext = config["extension"]

        # Java requires file named Main.java
        if language == "java":
            source_path = os.path.join(tmpdir, "Main.java")
        else:
            source_path = os.path.join(tmpdir, f"solution{ext}")

        binary_path = os.path.join(tmpdir, "solution")

        with open(source_path, "w") as f:
            f.write(code)

        # Compile if needed
        if config["compile_cmd"]:
            compile_cmd = [
                c.replace("{file}", source_path)
                 .replace("{binary}", binary_path)
                 .replace("{dir}", tmpdir)
                for c in config["compile_cmd"]
            ]
            try:
                result = subprocess.run(
                    compile_cmd,
                    capture_output=True,
                    text=True,
                    timeout=15,
                    cwd=tmpdir,
                )
                if result.returncode != 0:
                    err = result.stderr[:500]
                    return [
                        {"passed": False, "status": "compilation_error", "error": err, "test_case": i}
                        for i in range(len(test_cases))
                    ]
            except subprocess.TimeoutExpired:
                return [{"passed": False, "status": "compilation_error", "error": "Compile timeout"}
                        for _ in test_cases]

        # Run each test case
        run_cmd = [
            c.replace("{file}", source_path)
             .replace("{binary}", binary_path)
             .replace("{dir}", tmpdir)
            for c in config["run_cmd"]
        ]

        results = []
        for i, tc in enumerate(test_cases):
            result = _run_single(run_cmd, tc.input, tc.expected, time_limit_ms)
            result['test_case'] = i + 1
            results.append(result)

        return results


def _run_single(run_cmd: List[str], input_data: str, expected: str, time_limit_ms: int) -> dict:
    timeout_s = time_limit_ms / 1000

    def set_limits():
        try:
            # Limit memory to 256 MB (only on Linux)
            if sys.platform == "linux":
                resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
            # Limit CPU time
            resource.setrlimit(resource.RLIMIT_CPU, (int(timeout_s) + 1, int(timeout_s) + 2))
        except (ValueError, OSError):
            # Silently ignore if resource limits can't be set (e.g., on macOS)
            pass

    start = time.time()
    try:
        proc = subprocess.run(
            run_cmd,
            input=input_data,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            preexec_fn=set_limits if sys.platform not in ["win32", "darwin"] else None,
        )
        elapsed_ms = int((time.time() - start) * 1000)

        if proc.returncode != 0:
            return {
                "passed": False,
                "status": "runtime_error",
                "error": proc.stderr[:300],
                "time_ms": elapsed_ms,
            }

        actual = proc.stdout.strip()
        exp = expected.strip()

        return {
            "passed": actual == exp,
            "status": "accepted" if actual == exp else "wrong_answer",
            "actual": actual[:200],
            "expected": exp[:200],
            "time_ms": elapsed_ms,
        }

    except subprocess.TimeoutExpired:
        return {"passed": False, "status": "time_limit_exceeded", "time_ms": time_limit_ms}
    except Exception as e:
        return {"passed": False, "status": "runtime_error", "error": str(e)}
