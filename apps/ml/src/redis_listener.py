import asyncio
import json

from redis import Redis

from src.config import settings
from src.schemas import AnalyzeRequest
from src.router import route_to_provider


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
            "content": data.get("content", ""),
            "layer": data.get("layer", "LOGIC_CHAIN"),
            "context": data.get("context", False),
            "provingStatement": data.get("provingStatement", ""),
            "currentSentence": data.get("currentSentence", data.get("content", "")),
            "currentErrors": data.get("currentErrors", data.get("errors", [])),
            "allErrors": data.get("allErrors", []),
            "mathStatements": data.get("mathStatements", []),
        }
        request = AnalyzeRequest(**normalized)

        print(f"Processing document: {request.documentId}")

        response = await route_to_provider(request)

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
