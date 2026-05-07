import json
import google.generativeai as genai
from src.schemas import AnalyzeRequest, AnalyzeResponse, DetectedError, Suggestion
from src.config import settings
from src.AIprompts import constructPrompt

genai.configure(api_key=settings.GEMINI_API_KEY)

# Gemini model to use
model = genai.GenerativeModel("gemini-2.5-pro")


def getIndices(snippet: str) -> tuple[int, int]:
    # Placeholder index resolver for prototype mode.
    # Websocket can remap these indices later against live content.
    if not snippet:
        return (0, 0)
    return (0, len(snippet))

async def analyze_with_gemini(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Analyze the request with Gemini.
    """

    prompt = constructPrompt(request)

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
        errors = []


        for item in parsed:
            error_snippet = item.get("errorSnippet") or item.get("problematicContent") or ""
            eStart, eEnd = getIndices(error_snippet)

            suggestion_obj = item.get("suggestedFix") or item.get("suggestion")
            suggestion_content = ""
            suggestion_snippet = ""
            if isinstance(suggestion_obj, dict):
                suggestion_content = suggestion_obj.get("suggestionContent") or ""
                suggestion_snippet = suggestion_obj.get("suggestionSnippet") or suggestion_content
            else:
                suggestion_content = item.get("suggestionContent") or ""
                suggestion_snippet = item.get("suggestionSnippet") or suggestion_content

            sStart, sEnd = getIndices(suggestion_snippet)

            detectedErrors = DetectedError(
                startIndexError=eStart,
                endIndexError=eEnd,
                problematicContent=error_snippet,

                errorMessage=item.get("errorMessage", ""),
                layer=request.layer,
                suggestedFix=Suggestion(
                    suggestionContent=suggestion_content,
                    startIndexSuggestion=sStart,
                    endIndexSuggestion=sEnd
                ) if suggestion_content else None
            )


            errors.append(detectedErrors)

        return AnalyzeResponse(documentId=request.documentId, errors=errors)

    except Exception as e:
        print(f"Gemini error: {e}")
        return AnalyzeResponse(documentId=request.documentId, errors=[])
