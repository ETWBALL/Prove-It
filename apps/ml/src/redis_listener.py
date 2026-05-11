import asyncio
import json

from redis import Redis

from src.config import settings
from src.schemas import AnalyzeRequest
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

        request = Request(**normalized)
        print(f"Processing document: {request.documentId} for task type: {request.taskType}")

        # Create the request object based on the task type
        if request.taskType == 'question_analysis':
            request = AnalyzeQuestion(**request.payload)
        elif request.taskType == 'body_analysis':
            request = AnalyzeBody(**request.payload)
        elif request.taskType == 'sentence_analysis':
            request = AnalyzeSentence(**request.payload)
        else:
            raise ValueError(f"Invalid task type: {request.taskType}")


        # Get the model's JSON response
        response = await route_to_provider(request)

        # Format the response to the AnalyzeResponse schema
        response = formatResponse(request, response)

        # Publish result back to websocket
        redis.publish(
            f"ml:result:{request.documentId}",
            json.dumps(response.model_dump())
        )

        print(f"Result published for document: {request.documentId}")
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
