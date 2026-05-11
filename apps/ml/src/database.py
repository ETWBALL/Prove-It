import psycopg
from pgvector.psycopg import register_vector
from src.config import settings

DB_URL = (
    f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
    f"@{settings.DB_HOST}:5432/{settings.POSTGRES_DB}"
)

def initVectorDB() -> None:
    """
    Initialize the vector table.
    """
    with psycopg.connect(DB_URL, autocommit=True) as conn:
        register_vector(conn)

        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

            cur.execute("""
                CREATE TABLE IF NOT EXISTS documentsEmbeddings (
                    id SERIAL PRIMARY KEY,
                    documentId TEXT NOT NULL,
                    modelName TEXT DEFAULT 'gemini-embedding-2',
                    content TEXT,
                    embedding VECTOR(3072) NOT NULL,
                    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS hnsw_idx ON documentsEmbeddings
                USING hnsw (embedding vector_cosine_ops);
            """)
    print("Vector table initialized")