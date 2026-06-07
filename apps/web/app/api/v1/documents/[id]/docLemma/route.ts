import { prisma } from "@prove-it/db";
import { z } from "zod";
import { NextResponse } from "next/server";

// Request Schema
const RequestSchema = z.object({
    lemmaPublicId: z.string({ error: "Lemma public ID is required" }),
});

export async function POST(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
    /**
     * POST /api/v1/documents/[id]/docLemma
     * 
     * Adds a lemma to a documentLemma junction table. Call this before adding the lemma to the websocket doc state.
     */

    // (1) Get the document ID. 
    const documentPublicId = params.id;

    // (2) Get the lemma ID. Validate the request body using Zod
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validatedFields = RequestSchema.safeParse(body);
    if (!validatedFields.success) {
        return NextResponse.json({ error: z.flattenError(validatedFields.error).fieldErrors }, { status: 400 });
    }
    const { lemmaPublicId } = validatedFields.data;

    // (3) Add the lemma to the documentLemma junction table
    const documentLemma = await prisma.documentLemma.create({
        data: {
            document: { connect: { publicId: documentPublicId } },
            lemma: { connect: { publicId: lemmaPublicId } },
        },
    });

    // (4) Return the created documentLemma
    return NextResponse.json({ documentLemma }, { status: 201 });
}


export async function DELETE(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
    /**
     * DELETE /api/v1/documents/[id]/docLemma
     * Removes a lemma from a documentLemma junction table. 
     * This will be used in the proof settings tab to remove a lemma if the user does not want it.
     */

    // (1) Get the document ID
    const documentPublicId = params.id;

    // (2) Get the lemma ID. Validate the request body using Zod
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validatedFields = RequestSchema.safeParse(body);
    if (!validatedFields.success) {
        return NextResponse.json({ error: z.flattenError(validatedFields.error).fieldErrors }, { status: 400 });
    }
    const { lemmaPublicId } = validatedFields.data;

    // (3) Remove the lemma from the documentLemma junction table
    const documentLemma = await prisma.$transaction(async (tx) => {
        const row = await tx.documentLemma.findFirst({
            where: {
                document: { publicId: documentPublicId, deletedAt: null },
                lemma: { publicId: lemmaPublicId },
            },
        });

        if (!row) {
            return null;
        }

        return tx.documentLemma.delete({
            where: {
                privateDocumentId_privateLemmaId: {
                    privateDocumentId: row.privateDocumentId,
                    privateLemmaId: row.privateLemmaId,
                },
            },
        });
    });

    if (!documentLemma) {
        return NextResponse.json({ error: "Lemma not found on document" }, { status: 404 });
    }

    // (4) Return the deleted documentLemma
    return NextResponse.json({ documentLemma }, { status: 200 });
}