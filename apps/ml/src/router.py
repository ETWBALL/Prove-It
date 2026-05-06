from src.config import settings
from src.schemas import AnalyzeRequest, AnalyzeResponse
from src.models.gemini import analyze_with_gemini

async def route_to_provider(request: AnalyzeRequest) -> AnalyzeResponse:
    provider = settings.MODEL_PROVIDER.lower()

    print(f"Routing to provider: {provider}")

    if provider == "claude":
        from src.models.claude import analyze_with_claude

        return await analyze_with_claude(request)
    elif provider == "gemini":
        return await analyze_with_gemini(request)
    elif provider == "local":
        from src.models.local import analyze_with_local

        return await analyze_with_local(request)
    else:
        raise ValueError(f"Unknown provider: {provider}")
