from src.schemas import AnalyzeQuestion, AnalyzeBody, AnalyzeSentence
from src.AIprompts import constructPrompt1, constructPrompt2, constructPrompt3


def pickPrompt(request: Union[AnalyzeQuestion, AnalyzeBody, AnalyzeSentence]) -> str:
    """
    Choose the correct prompt according to what the task is.
    Request can either be a question analysis, body analysis, or sentence analysis.
    """
    if isinstance(request, AnalyzeQuestion):
        return constructPrompt1(request)
    elif isinstance(request, AnalyzeBody):
        return constructPrompt2(request)
    elif isinstance(request, AnalyzeSentence):
        return constructPrompt3(request)
    else:
        raise ValueError(f"Invalid request type: {type(request)}")


def formatResponse(request: Union[AnalyzeQuestion, AnalyzeBody, AnalyzeSentence], response: dict) -> Union[Response1, Response2]:
    """
    Format the response to the AnalyzeResponse schema.
    """
    formattedResponse = []
    if isinstance(request, AnalyzeQuestion):
        


    elif isinstance(request, AnalyzeBody) or isinstance(request, AnalyzeSentence):
        for error in response:
            if not isinstance(error, dict):
                print(f"Model did not follow the format: {error}")
                return None

                
            # Format the error response properly
            formattedResponse.append(DetectedError(
                startIndexError=error["startIndexError"],
                endIndexError=error["endIndexError"],
                problematicContent=error["problematicContent"],
                errorMessage=error["errorMessage"],
                errortype=error["errortype"],
                suggestedFix=error["suggestedFix"]
            ))
        return Response2(documentId=request.documentId, errors=formattedResponse)

    else:
        raise ValueError(f"Invalid request type: {type(request)}")
    

class DetectedError(BaseModel):

    # Location of the error in the document
    startIndexError: int
    endIndexError: int
    problematicContent: str

    # Message to the user
    errorMessage: str
    errortype: ErrorType
    suggestedFix: Optional[Suggestion] = None

# The full response back to websocket
class Response2(BaseModel):
    documentId: str
    errors: list[DetectedError]
    
    [
      {{
        "errorSnippet": "the exact string of text that is wrong",
        "errorMessage": "brief description",
        "internalReasoning": "Your step-by-step logic",
        "suggestedFix": {{ 
            "suggestionContent": "correct phrasing",
            "suggestionSnippet": "what text should be replaced" 
        }}
      }}
    ]