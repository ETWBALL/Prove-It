from src.config import settings
from src.schemas import (
    AnalyzeBody,
    AnalyzeQuestion,
    TaskType,
)
from src.models.gemini import analyze_with_gemini


async def route_to_provider(
    request: AnalyzeQuestion | AnalyzeBody,
    task_type: TaskType,
) -> dict | list:
    q = settings.QUESTION_ANALYSIS_MODEL.lower()
    b = settings.BODY_ANALYSIS_MODEL.lower()
    s = settings.SENTENCE_ANALYSIS_MODEL.lower()

    if task_type == TaskType.QUESTION_ANALYSIS:
        label = q
    elif task_type == TaskType.BODY_ANALYSIS:
        label = b
    elif task_type == TaskType.SENTENCE_ANALYSIS:
        label = s
    else:
        raise ValueError(f"Unknown task type: {task_type}")

    print(f"Routing task {task_type} (configured provider: {label})")
    if label not in ("gemini",):
        print(f"Provider '{label}' not wired; using gemini")
    return await analyze_with_gemini(request, task_type)
