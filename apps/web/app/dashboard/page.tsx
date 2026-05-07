/**
 * @file apps/web/app/api/v1/documents/route.ts
 * @description Handles fetching all documents for a user and creating new documents.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@prove-it/db";
import { verifyAccessToken } from "@prove-it/auth";
import { TokenPayloadSchema } from "@/lib/Validation/zodSchemas";

async function getAuthenticatedUserPrivateId(request: NextRequest): Promise<number | null> {
  const accessToken = request.cookies.get("accessToken")?.value;
  if (!accessToken) return null;

  const tokenResult = await verifyAccessToken(accessToken);
  if (!tokenResult.valid || !tokenResult.payload) return null;

  const parsedPayload = TokenPayloadSchema.safeParse(tokenResult.payload);
  if (!parsedPayload.success) return null;

  const user = await prisma.user.findUnique({
    where: { publicId: parsedPayload.data.publicId },
    select: { privateId: true },
  });

  return user?.privateId ?? null;
}

/**
 * GET /api/v1/documents
 * Fetches all documents belonging to the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verify Authentication
    const userId = await getAuthenticatedUserPrivateId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch Documents
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
export async function POST(request: NextRequest) {
  try {
    // 1. Verify Authentication
    const userId = await getAuthenticatedUserPrivateId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        privateOwnerId: userId,
        privateCourseId: courseId ?? null,
        proofType: "DIRECT",
        documentBody: {
          create: {
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