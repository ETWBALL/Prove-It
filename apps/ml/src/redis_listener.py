import asyncio
import json

from redis import Redis

from src.config import settings
from src.schemas import (
    AnalyzeBody,
    AnalyzeQuestion,
    Request,
    TaskType,
)
from src.router import route_to_provider
from src.helpers import formatResponse


# (1) Create Redis TCP client. Decode responses as strings.
redis = Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    password=settings.REDIS_PASSWORD or None,
    decode_responses=True,
)


# (2) Process a single message from the queue
async def process_message(message: str):
    try:
        data = json.loads(message)
        
        # Normalize websocket payload to current AnalyzeRequest schema.
        normalized = {
            "documentId": data.get("documentId", ""),
            "taskType": data.get("taskType", ""),
            "payload": data.get("payload", {}),
        }

        outer = Request(**normalized)
        doc_id = outer.documentId
        payload = {**outer.payload, "documentId": doc_id}
        print(f"Processing document: {doc_id} for task type: {outer.taskType}")

        responseType = None

        if outer.taskType == TaskType.QUESTION_ANALYSIS:
            responseType = "neededMathStatements"
            request = AnalyzeQuestion(**payload)
        elif outer.taskType in (
            TaskType.BODY_ANALYSIS,
            TaskType.SENTENCE_ANALYSIS,
        ):
            responseType = "detectedErrors" # type: ignore
            request = AnalyzeBody(**payload)
        else:
            raise ValueError(f"Invalid task type: {outer.taskType}")

        # Get the model's JSON response
        raw = await route_to_provider(request, outer.taskType)

        # Format the response to Response1 / Response2
        response = formatResponse(request, raw, outer.taskType)

        # Publish result back to websocket
        redis.publish(
            f"ml:result:{doc_id}",
            json.dumps({
                "type": responseType,
                "data":response.model_dump()}),
        )

        print(f"Result published for document: {doc_id}")
    except Exception as e:
        print(f"Error processing message: {e}")


# (3) Continuously listen to Redis queue with blocking pop
async def start_listener():
    print("Listening to Redis queue: ml:queue:analyze")

    while True:
        try:
            # BLPOP blocks until a message is available.
            result = await asyncio.to_thread(redis.blpop, "ml:queue:analyze", 0)

            if not result:
                continue

            _, message = result  # (key, value)
            asyncio.create_task(process_message(message))

        except Exception as e:
            print(f"Redis listener error: {e}")
            await asyncio.sleep(5)
