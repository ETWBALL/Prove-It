from src.config import settings
from src.schemas import AnalyzeRequest, AnalyzeResponse
from src.models.gemini import analyze_with_gemini

async def route_to_provider(request: Union[AnalyzeQuestion, AnalyzeBody, AnalyzeSentence], taskType: TaskType) -> Union[Response1, Response2]:
    provider1 = settings.QUESTION_ANALYSIS_MODEL.lower()
    provider2 = settings.BODY_ANALYSIS_MODEL.lower()
    provider3 = settings.SENTENCE_ANALYSIS_MODEL.lower()

    handlers = {
        "claude": analyze_with_claude,
        "gemini": analyze_with_gemini,
        "local": analyze_with_local,
    }

    # If this is a question analysis, return all of the definitions and theorems to prove the statement
    if taskType == 'question_analysis':
        print(f"Routing to provider: {provider1}")
        return await handlers[provider1](request)

    # If this is a full body analysis (or up to a certain sentence), return all logic chain + grammar errors
    elif taskType == 'body_analysis':
        print(f"Routing to provider: {provider2}")
        return await handlers[provider2](request)

    # If this is a single sentence analysis, simply return all of the grammatical errors for that sentence
    elif taskType == 'sentence_analysis':
        print(f"Routing to provider: {provider3}")
        return await handlers[provider3](request)

    else:
        raise ValueError(f"Unknown task type: {taskType}")
