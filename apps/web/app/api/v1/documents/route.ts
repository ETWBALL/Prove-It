/**
 * @file apps/web/app/api/v1/documents/route.ts
 * @description Handles fetching all documents for a user and creating new documents.
 */

import { NextResponse } from "next/server";
import { prisma } from "@prove-it/db";

async function getPrivateUserIdFromRequest(request: Request): Promise<number | null> {
  const publicUserId = request.headers.get("x-user-id");
  if (!publicUserId) return null;

  const user = await prisma.user.findUnique({
    where: { publicId: publicUserId },
    select: { privateId: true },
  });

  return user?.privateId ?? null;
}

/**
 * GET /api/v1/documents
 * Fetches all documents belonging to the authenticated user.
 */
export async function GET(request: Request) {
  try {
    const userId = await getPrivateUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch Documents
    const documents = await prisma.document.findMany({
      where: { privateOwnerId: userId, deletedAt: null },
      orderBy: { lastEdited: "desc" },
      select: {
        publicId: true,
        title: true,
        lastEdited: true,
        numErrors: true,
      }
    });

    return NextResponse.json({ documents }, { status: 200 });

  } catch (error) {
    console.error("GET Documents Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/v1/documents
 * Creates a new document and an associated empty DocumentBody.
 */
export async function POST(request: Request) {
  try {
    const userId = await getPrivateUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse Request Body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { title, courseId } = body as { title?: unknown; courseId?: unknown };

    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    let normalizedCourseId: number | null = null;
    if (courseId !== undefined && courseId !== null) {
      if (typeof courseId !== "number" || !Number.isInteger(courseId) || courseId <= 0) {
        return NextResponse.json({ error: "Invalid courseId" }, { status: 400 });
      }

      const enrollment = await prisma.userCourse.findFirst({
        where: {
          privateUserId: userId,
          privateCourseId: courseId,
          unenrolledAt: null,
        },
        select: { privateCourseId: true },
      });

      if (!enrollment) {
        return NextResponse.json({ error: "Course not found for user" }, { status: 400 });
      }

      normalizedCourseId = enrollment.privateCourseId;
    }

    // Create Document and DocumentBody in a single transaction
    const newDocument = await prisma.document.create({
      data: {
        title: title.trim(),
        privateOwnerId: userId,
        privateCourseId: normalizedCourseId,
        proofType: "DIRECT",
        documentBody: {
          create: {
            provingStatement: "",
            content: "" // Initialize with an empty string
          }
        }
      },
      include: {
        documentBody: true // Return the nested body so the client has the full state
      }
    });

    return NextResponse.json({ document: newDocument }, { status: 201 });

  } catch (error) {
    console.error("POST Document Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}