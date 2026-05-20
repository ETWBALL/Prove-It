import os

import psycopg
from pgvector.psycopg import register_vector
from psycopg.rows import dict_row

from src.schemas import MathStatement

# Prisma/Postgres URL (same as web/websocket).
DB_URL = os.getenv("DATABASE_URL")

# course publicId -> definitions only for that course (stable curriculum order).
courseMathStatements: dict[str, list[MathStatement]] = {}

if not DB_URL:
    raise ValueError("DATABASE_URL is not set")


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


def preload(coursePublicId: str) -> None:
    """
    Load all DEFINITION rows for one course into ``courseMathStatements[coursePublicId]``.
    """
    with psycopg.connect(DB_URL, autocommit=True) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT
                    ms."publicId",
                    (ms.type)::text AS library_type,
                    ms.name,
                    ms.content,
                    COALESCE(ms."hint", '') AS hint
                FROM "MathStatement" ms
                INNER JOIN "Course" c ON c."privateId" = ms."privateCourseId"
                WHERE c."publicId" = %s
                  AND ms.type = 'DEFINITION'::"Library"
                ORDER BY ms."orderIndex" ASC
                """,
                (coursePublicId,),
            )
            rows = cur.fetchall()

    courseMathStatements[coursePublicId] = [
        MathStatement(
            publicId=r["publicId"],
            type=r["library_type"],
            name=r["name"],
            content=r["content"] if r["content"] is not None else "",
            hint=str(r.get("hint") or ""),
        )
        for r in rows
    ]
    print(
        f"Course {coursePublicId}: {len(courseMathStatements[coursePublicId])} definitions cached"
    )


def preload_all_definitions() -> None:
    """
    Fill ``courseMathStatements`` for every course: ``{ coursePublicId: [def, ...] }``.
    Only ``Library`` values of DEFINITION are included, ordered by ``orderIndex`` per course.
    """
    courseMathStatements.clear()
    with psycopg.connect(DB_URL, autocommit=True) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT
                    c."publicId" AS course_public_id,
                    ms."publicId",
                    (ms.type)::text AS library_type,
                    ms.name,
                    ms.content,
                    COALESCE(ms."hint", '') AS hint
                FROM "MathStatement" ms
                INNER JOIN "Course" c ON c."privateId" = ms."privateCourseId"
                WHERE ms.type = 'DEFINITION'::"Library"
                ORDER BY c."publicId", ms."orderIndex" ASC
                """
            )
            for r in cur:
                cid = r["course_public_id"]
                stmt = MathStatement(
                    publicId=r["publicId"],
                    type=r["library_type"],
                    name=r["name"],
                    content=r["content"] if r["content"] is not None else "",
                    hint=str(r.get("hint") or ""),
                )
                courseMathStatements.setdefault(cid, []).append(stmt)

    print(f"Preloaded definitions for {len(courseMathStatements)} courses")
