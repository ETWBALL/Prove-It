import json
import google.generativeai as genai
from src.schemas import AnalyzeRequest, AnalyzeResponse, DetectedError, Suggestion, ErrorType, Severity, ValidationLayer
from src.config import settings
from src.AIprompts import get_prompt

genai.configure(api_key=settings.GEMINI_API_KEY)

# Gemini model to use
model = genai.GenerativeModel("gemini-2.5-pro")

async def analyze_with_gemini(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Analyze the request with Gemini.
    """
    prompt = get_prompt(request)

    try:
        response = await model.generate_content_async(prompt)
        raw = response.text.strip()

        # Strip markdown fences if Gemini ignores instructions
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        # Parse the response as JSON
        parsed = json.loads(raw)

        # Collect all errors from gemini's response
        errors = [
            DetectedError(
                startIndexError=item["startIndexError"],
                endIndexError=item["endIndexError"],
                errorContent=item["errorContent"],
                type=ErrorType(item["type"]),
                severity=Severity(item["severity"]),
                layer=ValidationLayer(request.layer),
                suggestion=Suggestion(**item["suggestion"]) if item.get("suggestion") else None     #Checks if the suggestion is present and if so, parses it into a Suggestion object
            )
            for item in parsed
        ]

        return AnalyzeResponse(documentId=request.documentId, errors=errors)

    except Exception as e:
        print(f"Gemini error: {e}")
        return AnalyzeResponse(documentId=request.documentId, errors=[])
