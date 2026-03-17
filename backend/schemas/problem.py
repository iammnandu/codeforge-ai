from pydantic import BaseModel
from typing import Optional, List


class TestCaseCreate(BaseModel):
    input: str
    expected: str
    is_sample: bool = False


class TestCaseOut(BaseModel):
    id: int
    input: str
    expected: str
    is_sample: bool

    class Config:
        from_attributes = True


class ProblemCreate(BaseModel):
    title: str
    description: str
    input_format: Optional[str] = ""
    output_format: Optional[str] = ""
    constraints: Optional[str] = ""
    difficulty: str = "medium"
    time_limit_ms: int = 2000
    memory_limit_mb: int = 256
    is_public: bool = True
    sample_input: Optional[str] = ""
    sample_output: Optional[str] = ""
    tags: List[str] = []
    test_cases: List[TestCaseCreate] = []


class ProblemOut(BaseModel):
    id: int
    title: str
    slug: str
    difficulty: str
    tags: List[str]
    time_limit_ms: int
    memory_limit_mb: int
    is_public: bool

    class Config:
        from_attributes = True


class ProblemDetail(ProblemOut):
    description: str
    input_format: Optional[str]
    output_format: Optional[str]
    constraints: Optional[str]
    sample_input: Optional[str]
    sample_output: Optional[str]
    test_cases: List[TestCaseOut] = []


class ProblemGenerateIn(BaseModel):
    prompt: str
    difficulty: str = "medium"


class ProblemGenerateOut(BaseModel):
    title: str
    description: str
    input_format: str
    output_format: str
    constraints: str
    difficulty: str
    time_limit_ms: int
    memory_limit_mb: int
    sample_input: str
    sample_output: str
    tags: List[str] = []
    test_cases: List[TestCaseCreate] = []
