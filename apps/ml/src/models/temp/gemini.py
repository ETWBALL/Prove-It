import json
from typing import Optional, Tuple
import google.generativeai as genai
from src.schemas import AnalyzeRequest, AnalyzeResponse, DetectedError, ErrorType, Suggestion
from src.config import settings
from src.AIprompts import constructPrompt

genai.configure(api_key=settings.GEMINI_API_KEY)

# Gemini model to use
model = genai.GenerativeModel("gemini-2.5-pro")


def _first_span(haystack: str, needle: str) -> Optional[Tuple[int, int]]:
    if not needle or not haystack:
        return None
    idx = haystack.find(needle)
    if idx < 0:
        return None
    return idx, idx + len(needle)


def span_in_document_body(request: AnalyzeRequest, snippet: str) -> Tuple[int, int]:
    """
    Indices are character offsets into `request.content` (what the websocket/DB uses for slicing).

    The model returns a verbatim substring (`errorSnippet`); locate it against the bodies we sent.
    """
    if not snippet:
        return 0, 0

    body = request.content or ""
    span = _first_span(body, snippet)
    if span:
        return span

    trimmed = snippet.strip()
    if trimmed != snippet:
        span = _first_span(body, trimmed)
        if span:
            return span

    # Current sentence slice might be canonical when `content` is only a snippet; offsets still
    # match DB if callers keep `request.content === fullDocumentText`.
    sent = request.currentSentence or ""
    if sent:
        in_sent = _first_span(sent, snippet) or (
            _first_span(sent, trimmed) if trimmed != snippet else None
        )
        if in_sent is not None:
            base = body.find(sent)
            if base >= 0:
                start = base + in_sent[0]
                end = base + in_sent[1]
                return start, end

    # Fallback: substring not found (model paraphrased text or encoding mismatch).
    print(
        "WARNING: Could not locate model snippet in request.content/currentSentence — "
        "indices default to legacy (0, len(snippet))",
    )
    return 0, len(snippet)


def suggestion_span(
    request: AnalyzeRequest,
    suggestion_snippet: str,
    error_span: Tuple[int, int],
) -> Tuple[int, int]:
    """
    Suggestion snippets are often replacements and may not exist verbatim in the document.
    Prefer search; otherwise assume the correction targets the error range.
    """
    if not suggestion_snippet:
        return error_span

    body = request.content or ""
    span = _first_span(body, suggestion_snippet)
    if span:
        return span
    trimmed = suggestion_snippet.strip()
    if trimmed != suggestion_snippet:
        span = _first_span(body, trimmed)
        if span:
            return span

    sent = request.currentSentence or ""
    if sent:
        in_sent = _first_span(sent, suggestion_snippet) or _first_span(sent, trimmed)
        if in_sent is not None:
            base = body.find(sent)
            if base >= 0:
                return base + in_sent[0], base + in_sent[1]

    # Same span as problematic text (replacement for that substring).
    return error_span


def parse_error_type(item: dict) -> ErrorType:
    raw = (
        item.get("errorType")
        or item.get("errortype")
        or item.get("type")
        or ""
    )
    if isinstance(raw, str):
        raw = raw.strip()
    try:
        if raw:
            return ErrorType(raw)
    except ValueError:
        pass
    return ErrorType.MISSING_JUSTIFICATION

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
        if isinstance(parsed, dict):
            parsed = [parsed]
        if not isinstance(parsed, list):
            return AnalyzeResponse(documentId=request.documentId, errors=[])

        # Collect all errors from gemini's response
        errors = []


        for item in parsed:
            if not isinstance(item, dict):
                continue
            raw_snippet = item.get("errorSnippet") or item.get("problematicContent") or ""
            error_snippet = raw_snippet if isinstance(raw_snippet, str) else str(raw_snippet or "")
            eStart, eEnd = span_in_document_body(request, error_snippet)
            suggestion_obj = item.get("suggestedFix") or item.get("suggestion")
            suggestion_content = ""
            suggestion_snippet = ""
            if isinstance(suggestion_obj, dict):
                sc = suggestion_obj.get("suggestionContent") or ""
                ss = suggestion_obj.get("suggestionSnippet") or sc
                suggestion_content = sc if isinstance(sc, str) else str(sc or "")
                suggestion_snippet = ss if isinstance(ss, str) else str(ss or "")
            else:
                sc = item.get("suggestionContent") or ""
                ss = item.get("suggestionSnippet") or sc
                suggestion_content = sc if isinstance(sc, str) else str(sc or "")
                suggestion_snippet = ss if isinstance(ss, str) else str(ss or "")

            sStart, sEnd = suggestion_span(
                request,
                suggestion_snippet,
                (eStart, eEnd),
            )

            detectedErrors = DetectedError(
                startIndexError=eStart,
                endIndexError=eEnd,
                problematicContent=error_snippet,

                errorMessage=item.get("errorMessage", ""),
                errortype=parse_error_type(item),
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
