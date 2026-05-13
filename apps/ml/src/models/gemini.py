import json

from google import genai
from google.genai import types

from src.config import settings
from src.helpers import pickPrompt
from src.schemas import (
    AnalyzeBody,
    AnalyzeQuestion,
    ProofType,
    TaskType,
)

client = genai.Client(api_key=settings.GEMINI_API_KEY)

MODEL_NAME = "gemini-2.5-pro"


async def analyze_with_gemini(request: AnalyzeQuestion | AnalyzeBody,task_type: TaskType) -> dict | list:
    prompt = pickPrompt(request, task_type)
    if not prompt.strip():
        return [] if not isinstance(request, AnalyzeQuestion) else {}

    try:
        response = await client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        text = response.text or ""
        if not text.strip():
            return [] if not isinstance(request, AnalyzeQuestion) else {}
        parsed = json.loads(text)
        if isinstance(request, AnalyzeQuestion) and not isinstance(parsed, dict):
            return {}
        if not isinstance(request, AnalyzeQuestion) and not isinstance(parsed, list):
            return []
        return parsed
        
    except Exception as e:
        print(f"Gemini error: {e}")
        if isinstance(request, AnalyzeQuestion):
            return {
                "recommended_proof_type": (
                    request.currentProofType.value
                    if request.currentProofType
                    else ProofType.DIRECT.value
                ),
                "add_math_statements": [],
                "remove_math_statements": [],
            }
        return []
