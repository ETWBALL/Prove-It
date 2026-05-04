import asyncio
import json
from upstash_redis import Redis
from src.config import settings
from src.schemas import AnalyzeRequest, AnalyzeResponse
from src.router import route_to_provider

# (1) Create Redis client
redis = Redis(
    url=settings.UPSTASH_REDIS_REST_URL,
    token=settings.UPSTASH_REDIS_REST_TOKEN
)

# (2) Process a single message from the queue
async def process_message(message: str):
    try:
        # Parse the incoming message
        data = json.loads(message)
        request = AnalyzeRequest(**data)

        print(f"Processing document: {request.documentId}")

        # Route to the correct model provider
        response = await route_to_provider(request)

        # Publish result back to websocket
        await redis.publish(
            f"ml:result:{request.documentId}",
            json.dumps(response.dict())
        )

        print(f"Result published for document: {request.documentId}")

    except Exception as e:
        print(f"Error processing message: {e}")


# (3) Continuously listen to Redis channel
async def start_listener():
    print("Listening to Redis channel: ml:queue:analyze")

    while True:
        try:
            # Block and wait for a message (blpop waits until something arrives)
            message = await redis.blpop("ml:queue:analyze", timeout=0)
            
            if message:
                # message is a tuple: (channel, data)
                _, data = message
                asyncio.create_task(process_message(data))

        except Exception as e:
            print(f"Redis listener error: {e}")
            # Wait before retrying to avoid hammering Redis on failure
            await asyncio.sleep(5)
