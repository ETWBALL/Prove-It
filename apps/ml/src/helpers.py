from __future__ import annotations

import json
from typing import Optional, Union

from src.schemas import (
    AnalyzeBody,
    AnalyzeQuestion,
    DetectedError,
    ErrorType,
    MathStatement,
    ProofType,
    Response1,
    Response2,
    Suggestion,
    TaskType,
)
from src.AIprompts import constructPrompt1, constructPrompt2, constructPrompt3


def pickPrompt(request: Union[AnalyzeQuestion, AnalyzeBody], task_type: TaskType) -> str:
    """
    Choose the correct prompt: question vs logic-chain body vs grammar sentence.
    ``AnalyzeBody`` is shared; ``task_type`` selects constructPrompt2 vs constructPrompt3.
    """
    if isinstance(request, AnalyzeQuestion):
        if task_type != TaskType.QUESTION_ANALYSIS:
            raise ValueError(
                f"AnalyzeQuestion incompatible with task_type {task_type}"
            )
        return constructPrompt1(request)
    if isinstance(request, AnalyzeBody):
        if task_type == TaskType.BODY_ANALYSIS:
            return constructPrompt2(request)
        if task_type == TaskType.SENTENCE_ANALYSIS:
            return constructPrompt3(request)
        raise ValueError(f"AnalyzeBody incompatible with task_type {task_type}")
    raise ValueError(f"Invalid request type: {type(request)}")


def _snippet_indices(text: str, snippet: str) -> tuple[int, int]:
    """
    Finds the indices of the snippet inside a larger body
    """

    if not snippet or not text:
        return 0, 0
    idx = text.find(snippet)
    if idx < 0:
        return 0, 0
    return idx, idx + len(snippet)


def _flatten_master_by_name() -> dict[str, MathStatement]:
    """
    This helper function makes it easier to find math titles inside our 
    course-math dictionaries.
    """
    from src.database import courseMathStatements

    seen: set[str] = set()
    by_name: dict[str, MathStatement] = {}
    for defs in courseMathStatements.values():
        for m in defs:
            if m.publicId in seen:
                continue
            seen.add(m.publicId)
            key = m.name.strip().casefold()
            by_name.setdefault(key, m)
    return by_name


def _math_statement_for_add(title: str, application_hint: str) -> MathStatement:
    hint_text = (application_hint or "").strip()
    master = _flatten_master_by_name()
    key = title.strip().casefold()
    base = master.get(key)
    if base:
        return MathStatement(
            publicId=base.publicId,
            type=base.type,
            name=base.name,
            content=base.content,
            hint=hint_text,
        )
    return MathStatement(
        publicId="",
        type="DEFINITION",
        name=title.strip(),
        content="",
        hint=hint_text,
    )


def _math_statement_for_remove(
    title: str, reason: str, current: list[MathStatement]
) -> MathStatement:
    key = title.strip().casefold()
    for m in current:
        if m.name.strip().casefold() == key:
            return MathStatement(
                publicId=m.publicId,
                type=m.type,
                name=m.name,
                content=m.content,
                hint=(reason or "").strip(),
            )
    return MathStatement(
        publicId="",
        type="DEFINITION",
        name=title.strip(),
        content="",
        hint=(reason or "").strip(),
    )


def _coerce_error_type(raw: object, default: ErrorType) -> ErrorType:
    """
    Returns whatever Gemini returns for errors into a valid ErrorType enum
    """
    if raw is None:
        return default
    s = str(raw).strip()
    if not s:
        return default
    try:
        return ErrorType(s)
    except ValueError:
        pass
    try:
        return ErrorType[s]
    except KeyError:
        return default


def _normalize_errors_payload(raw: Union[dict, list]) -> list:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for k in ("errors", "data", "items"):
            v = raw.get(k)
            if isinstance(v, list):
                return v
        return [raw]
    return []


def _full_proof_for_indexing(request: AnalyzeBody) -> str:
    """
    Canonical proof string for document indices. Prefer ``fullProofContent`` from the client;
    fall back to prefix + sentence for older payloads without the full document.
    """
    s = (request.fullProofContent or "").strip()
    if s:
        return s
    return request.content + request.currentSentence


def _sentence_anchor_in_full_proof(full_proof: str, sentence: str) -> int:
    if not full_proof or not sentence:
        return -1
    return full_proof.find(sentence)


def _span_from_snippet_in_full_proof(
    full_proof: str,
    snippet: str,
    sentence: str,
) -> Optional[tuple[int, int]]:
    """
    Prefer locating ``snippet`` inside the current-sentence window in ``full_proof``;
    otherwise first occurrence in ``full_proof``.
    """
    if not full_proof or not snippet:
        return None
    sent = sentence or ""
    sent_start = _sentence_anchor_in_full_proof(full_proof, sent) if sent else -1
    if sent_start >= 0:
        window = full_proof[sent_start : sent_start + len(sent)]
        rel = window.find(snippet)
        if rel >= 0:
            i = sent_start + rel
            return i, i + len(snippet)
    idx = full_proof.find(snippet)
    if idx >= 0:
        return idx, idx + len(snippet)
    return None


def _clamp_span(full_proof: str, start: int, end: int) -> tuple[int, int]:
    plen = len(full_proof)
    start = max(0, min(start, plen))
    end = max(start, min(end, plen))
    return start, end


def _normalize_error_span_in_full_proof(
    request: AnalyzeBody,
    snippet: str,
    start_raw: object,
    end_raw: object,
) -> tuple[int, int]:
    """
    Map model output to ``[start, end)`` in the full proof. Primary: locate ``errorSnippet`` in
    ``fullProofForIndexing``. Secondary: use model ints only if they already fit the full proof.
    """
    full_proof = _full_proof_for_indexing(request)
    sentence_text = request.currentSentence or ""
    plen = len(full_proof)

    pair = _span_from_snippet_in_full_proof(full_proof, snippet, sentence_text)
    if pair is not None:
        return _clamp_span(full_proof, pair[0], pair[1])

    if isinstance(start_raw, int) and isinstance(end_raw, int):
        st, en = start_raw, end_raw
        if 0 <= st < plen and st < en <= plen:
            return _clamp_span(full_proof, st, en)

    return _clamp_span(full_proof, 0, 0)


def _parse_suggested_fix(
    raw: object,
    sentence_text: str,
    full_proof: str,
) -> Optional[Suggestion]:
    if raw is None:
        return None
    if isinstance(raw, str):
        s = raw.strip()
        return Suggestion(suggestionContent=s) if s else None
    if not isinstance(raw, dict):
        return None
    content = str(
        raw.get("suggestionContent") or raw.get("suggestion_content") or ""
    ).strip()
    snippet = str(
        raw.get("suggestionSnippet") or raw.get("suggestion_snippet") or ""
    ).strip()
    if not content and not snippet:
        return None
    start, end = _snippet_indices(sentence_text, snippet)
    anchor = _sentence_anchor_in_full_proof(full_proof, sentence_text)
    if anchor < 0:
        anchor = 0
    start += anchor
    end += anchor
    start, end = _clamp_span(full_proof, start, end)
    return Suggestion(
        suggestionContent=content or snippet,
        startIndexSuggestion=start,
        endIndexSuggestion=end,
    )


def _coerce_raw_response(
    response: Union[dict, list, str, None],
) -> Union[dict, list]:
    if response is None:
        return {}
    if isinstance(response, str):
        try:
            parsed = json.loads(response)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, (dict, list)) else {}
    return response


def formatResponse(
    request: Union[AnalyzeQuestion, AnalyzeBody],
    response: Union[dict, list, str, None],
    task_type: TaskType,
) -> Union[Response1, Response2]:
    """
    Map model JSON (prompt 1 object, prompts 2–3 array) onto Response1 / Response2.
    """
    raw = _coerce_raw_response(response)

    if isinstance(request, AnalyzeQuestion):
        if task_type != TaskType.QUESTION_ANALYSIS:
            raise ValueError(
                f"AnalyzeQuestion requires QUESTION_ANALYSIS, got {task_type}"
            )
        data = raw if isinstance(raw, dict) else {}
        rec = data.get("recommended_proof_type") or data.get("recommendedProofType")
        proof_type: ProofType
        if rec is not None and str(rec).strip():
            try:
                proof_type = ProofType(str(rec).strip())
            except ValueError:
                proof_type = request.currentProofType or ProofType.DIRECT
        else:
            proof_type = request.currentProofType or ProofType.DIRECT

        adds_raw = (
            data.get("add_math_statements")
            or data.get("addMathStatements")
            or []
        )
        removes_raw = (
            data.get("remove_math_statements")
            or data.get("removeMathStatements")
            or []
        )

        add_math: list[MathStatement] = []
        if isinstance(adds_raw, list):
            for item in adds_raw:
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title") or "").strip()
                if not title:
                    continue
                hint = str(
                    item.get("application_hint")
                    or item.get("applicationHint")
                    or item.get("hint")
                    or ""
                ).strip()
                add_math.append(_math_statement_for_add(title, hint))

        remove_math: list[MathStatement] = []
        if isinstance(removes_raw, list):
            for item in removes_raw:
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title") or "").strip()
                if not title:
                    continue
                reason = str(
                    item.get("reason") or item.get("hint") or ""
                ).strip()
                remove_math.append(
                    _math_statement_for_remove(
                        title, reason, request.currentMathStatements
                    )
                )

        return Response1(
            documentId=request.documentId,
            proofType=proof_type,
            addMathStatements=add_math,
            removeMathStatements=remove_math,
        )

    if isinstance(request, AnalyzeBody) and task_type in (
        TaskType.BODY_ANALYSIS,
        TaskType.SENTENCE_ANALYSIS,
    ):
        errors_list = _normalize_errors_payload(
            raw if isinstance(raw, (dict, list)) else []
        )
        sentence_text = request.currentSentence or ""
        full_proof = _full_proof_for_indexing(request)
        default_err = (
            ErrorType.INFORMAL_LANGUAGE
            if task_type == TaskType.SENTENCE_ANALYSIS
            else ErrorType.NON_SEQUITUR
        )

        formatted: list[DetectedError] = []
        for error in errors_list:
            if not isinstance(error, dict):
                print(f"Model did not follow the format: {error}")
                continue

            start_raw = error.get("startIndexError")
            end_raw = error.get("endIndexError")
            snippet = str(
                error.get("errorSnippet")
                or error.get("problematicContent")
                or error.get("problematic_content")
                or "",
            ).strip()

            start_idx, end_idx = _normalize_error_span_in_full_proof(
                request,
                snippet,
                start_raw,
                end_raw,
            )

            problematic = str(
                error.get("problematicContent") or error.get("problematic_content") or ""
            ).strip()
            if not problematic and full_proof and start_idx < end_idx:
                problematic = full_proof[start_idx:end_idx]
            if not problematic:
                problematic = snippet

            msg = str(error.get("errorMessage") or error.get("error_message") or "").strip()
            reasoning = str(error.get("internalReasoning") or "").strip()
            if not msg and reasoning:
                msg = reasoning

            err_t = _coerce_error_type(
                error.get("errortype") or error.get("errorType"),
                default_err,
            )

            suggested = _parse_suggested_fix(
                error.get("suggestedFix") or error.get("suggested_fix"),
                sentence_text,
                full_proof,
            )

            formatted.append(
                DetectedError(
                    startIndexError=start_idx,
                    endIndexError=end_idx,
                    problematicContent=problematic,
                    errorMessage=msg or err_t.value,
                    errortype=err_t,
                    suggestedFix=suggested,
                )
            )

        return Response2(documentId=request.documentId, errors=formatted)

    raise ValueError(f"Invalid request type: {type(request)}")
