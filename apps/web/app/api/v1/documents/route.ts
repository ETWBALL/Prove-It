/**
 * @file apps/web/app/api/v1/documents/route.ts
 * @description Handles fetching all documents for a user and creating new documents.
 */

import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

// TODO: Import your specific auth verification utility from @repo/auth
// import { verifySession } from "@repo/auth/auth-utility";

/**
 * GET /api/v1/documents
 * Fetches all documents belonging to the authenticated user.
 */
export async function GET(request: Request) {
  try {
    // 1. Verify Authentication (Mocked for now)
    // const session = await verifySession(request);
    // if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    // MOCK USER ID for testing until auth middleware is plugged in
    const userId = 1; 

    // 2. Fetch Documents
    const documents = await prisma.document.findMany({
      where: { privateUserId: userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        publicId: true,
        title: true,
        updatedAt: true,
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
    // 1. Verify Authentication (Mocked for now)
    const userId = 1; 

    // 2. Parse Request Body
    const body = await request.json();
    const { title, courseId } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // 3. Create Document and DocumentBody in a single transaction
    const newDocument = await prisma.document.create({
      data: {
        title,
        privateUserId: userId,
        courseId: courseId || null,
        body: {
          create: {
            content: "" // Initialize with an empty string
          }
        }
      },
      include: {
        body: true // Return the nested body so the client has the full state
      }
    });

    return NextResponse.json({ document: newDocument }, { status: 201 });

  } catch (error) {
    console.error("POST Document Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}