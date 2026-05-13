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
    hint = (application_hint or "").strip()
    master = _flatten_master_by_name()
    key = title.strip().casefold()
    base = master.get(key)
    if base:
        return MathStatement(
            publicId=base.publicId,
            type=base.type,
            name=base.name,
            content=hint or base.content,
        )
    return MathStatement(
        publicId="",
        type="DEFINITION",
        name=title.strip(),
        content=hint,
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
                content=(reason or "").strip() or m.content,
            )
    return MathStatement(
        publicId="",
        type="DEFINITION",
        name=title.strip(),
        content=(reason or "").strip(),
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


def _parse_suggested_fix(raw: object, sentence: str) -> Optional[Suggestion]:
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
    start, end = _snippet_indices(sentence, snippet)
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
                    item.get("application_hint") or item.get("applicationHint") or ""
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
                reason = str(item.get("reason") or "").strip()
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

            if isinstance(start_raw, int) and isinstance(end_raw, int):
                start_idx, end_idx = start_raw, end_raw
            else:
                start_idx, end_idx = _snippet_indices(sentence_text, snippet)

            problematic = str(
                error.get("problematicContent") or error.get("problematic_content") or ""
            ).strip() or snippet

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
