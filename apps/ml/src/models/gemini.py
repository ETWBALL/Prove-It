import json
from google import genai
from google.genai import types
from src.schemas import AnalyzeRequest, AnalyzeResponse, DetectedError, ErrorType, Suggestion
from src.config import settings
from src.AIprompts import constructPrompt
from src.helpers import pickPrompt

client = genai.Client(api_key=settings.GEMINI_API_KEY)

# Gemini model to use
MODEL_NAME = "gemini-2.5-pro"

async def analyze_with_gemini(request: AnalyzeRequest) -> AnalyzeResponse:
"""
Analyze the request with Gemini. Use Gemini's API, choose which prompt to select based on the request type, 
"""
    # Pick the correct prompt based on the request type
    prompt = pickPrompt(request)

    try:

        # Get the model's response. Must be in JSON format. 
        response = await client.aio.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )

        return json.loads(response.text)
        
        # Strip markdown fences if Gemini ignores instructions
        #raw = re.sub(r"^```(?:json)?\n?(.*?)\n?```$", r"\1", raw, flags=re.DOTALL)


    except Exception as e:
        print(f"Gemini error: {e}")

        if isinstance(request, AnalyzeQuestion):
            return Response1(documentId=request.documentId, proofType: none, mathStatements: [])

