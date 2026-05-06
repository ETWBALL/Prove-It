/**
 * @file apps/web/app/api/v1/documents/[id]/route.ts
 * @description Handles fetching, updating, and deleting a specific document by its public ID.
 */

import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@prove-it/db";
import { verifySession } from "@prove-it/packages/auth/auth-utility";

/**
 * GET /api/v1/documents/[id]
 * Retrieves a single document and its nested body content.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentPublicId = params.id;
    const session = await verifySession(request);
    const userId = session?.userId || 1; // Fallback for testing

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const document = await prisma.document.findUnique({
      where: { 
        publicId: documentPublicId,
        privateUserId: userId // Security check: Ensure it belongs to the requester
      },
      include: {
        body: true,
      }
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ document }, { status: 200 });

  } catch (error) {
    console.error("GET Document Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/documents/[id]
 * Updates a document's title and/or its body content.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentPublicId = params.id;
    const session = await verifySession(request);
    const userId = session?.userId || 1; 

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { title, content } = body;

    // Security: Verify document ownership before updating
    const existingDoc = await prisma.document.findUnique({
      where: { publicId: documentPublicId },
      select: { privateUserId: true }
    });

    if (!existingDoc || existingDoc.privateUserId !== userId) {
      return NextResponse.json({ error: "Document not found or access denied" }, { status: 404 });
    }

    // Prepare update data payload dynamically
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    
    // If content is provided, update the connected DocumentBody
    if (content !== undefined) {
      updateData.body = {
        update: { content }
      };
    }

    const updatedDocument = await prisma.document.update({
      where: { publicId: documentPublicId },
      data: updateData,
      include: { body: true }
    });

    return NextResponse.json({ document: updatedDocument }, { status: 200 });

  } catch (error) {
    console.error("PATCH Document Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/documents/[id]
 * Deletes a document (Prisma Cascade rules handle deleting the DocumentBody and Attempts).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentPublicId = params.id;
    const session = await verifySession(request);
    const userId = session?.userId || 1; 

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Security: Verify ownership
    const existingDoc = await prisma.document.findUnique({
      where: { publicId: documentPublicId },
      select: { privateUserId: true }
    });

    if (!existingDoc || existingDoc.privateUserId !== userId) {
      return NextResponse.json({ error: "Document not found or access denied" }, { status: 404 });
    }

    await prisma.document.delete({
      where: { publicId: documentPublicId }
    });

    return NextResponse.json({ message: "Document deleted successfully" }, { status: 200 });

  } catch (error) {
    console.error("DELETE Document Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}