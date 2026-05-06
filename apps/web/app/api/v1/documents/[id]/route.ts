/**
 * @file apps/web/app/api/v1/documents/[id]/route.ts
 * @description Handles fetching, updating, and deleting a specific document by its public ID.
 */

import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

/**
 * GET /api/v1/documents/[id]
 * Retrieves a single document and its nested body content.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const documentPublicId = params.id;

    // TODO: Verify Auth here and ensure the document belongs to the privateUserId

    const document = await prisma.document.findUnique({
      where: { publicId: documentPublicId },
      include: {
        body: true,
      }
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
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
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const documentPublicId = params.id;
    const body = await request.json();
    const { title, content } = body;

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
 * Deletes a document (Prisma Cascade rules will handle deleting the DocumentBody).
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const documentPublicId = params.id;

    await prisma.document.delete({
      where: { publicId: documentPublicId }
    });

    return NextResponse.json({ message: "Document deleted successfully" }, { status: 200 });

  } catch (error) {
    console.error("DELETE Document Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}