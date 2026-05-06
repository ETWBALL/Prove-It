import json
import google.generativeai as genai
from src.schemas import AnalyzeRequest, AnalyzeResponse, DetectedError, Suggestion, ErrorType, Severity, ValidationLayer
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
            eStart, eEnd = getIndices(item["errorSnippet"])
            sStart, sEnd = getIndices(item["suggestionSnippet"])

            detectedErrors = DetectedError(
                startIndexError=eStart,
                endIndexError=eEnd,
                problematicContent=item["errorSnippet"],

                errorMessage=item["errorMessage"],
                errorType=ErrorType(item["errorType"]),
                layer=ValidationLayer(request.layer),
                suggestion=Suggestion(suggestionContent=item["suggestionContent"], startIndexSuggestion=sStart, endIndexSuggestion=sEnd) if item.get("suggestion") else None     #Checks if the suggestion is present and if so, parses it into a Suggestion object
            )


            errors.append(detectedErrors)

        return AnalyzeResponse(documentId=request.documentId, errors=errors)

    except Exception as e:
        print(f"Gemini error: {e}")
        return AnalyzeResponse(documentId=request.documentId, errors=[])
