import { DocumentSession, HotDocumentState } from "./shared-types";
import { DocumentOrchestrator } from "./DocumentOrchestrator";
import { ConnectionTimerPool } from "./ConnectionTimerPool";
import { PrismaClient } from "@prisma/client";

export class DocumentSessionRegistry {
  private sessions = new Map<string, DocumentSession>(); // key: socketId
  private documents = new Map<number, DocumentOrchestrator>(); // key: documentId
  private timerPool: ConnectionTimerPool;

  constructor(private prisma: PrismaClient, private wsServerBroadcast: (docId: number, state: any) => void) {

    this.timerPool = new ConnectionTimerPool(async (userId, docId) => {
      await this.flushDocumentToDatabase(docId);
    });
  }

  public async handleJoinRoom(socketId: string, userId: number, documentId: number) {
    // 1. Cancel clean-up task if user reconnected within grace window
    const wasRecovered = this.timerPool.cancelGracePeriod(userId, documentId);

    // 2. Bind network session
    this.sessions.set(socketId, { socketId, userId, documentId, joinedAt: new Date() });

    // 3. Load from database if document isn't hot in RAM yet
    if (!this.documents.has(documentId)) {
      const dbRecord = await this.prisma.document.findUnique({
        where: { privateId: documentId },
        include: {
          documentBody: true,
          usedLemmas: { include: { lemma: true } }
        }
      });

      if (!dbRecord) throw new Error("Document not found");

      const orchestrator = new DocumentOrchestrator(dbRecord, (updatedState) => {
        this.wsServerBroadcast(documentId, updatedState);
      });

      this.documents.set(documentId, orchestrator);
    }

    // Immediately push out existing snapshot frame to joining client
    return this.documents.get(documentId)!.state;
  }

  public handleLeaveRoom(socketId: string) {
    const session = this.sessions.get(socketId);
    if (!session) return;

    this.sessions.delete(socketId);

    // Evaluate remaining active socket connections in this document workspace
    const remainingConnections = Array.from(this.sessions.values()).some(
      (s) => s.documentId === session.documentId
    );

    // If completely empty room, schedule grace period sweep timer
    if (!remainingConnections) {
      this.timerPool.startGracePeriod(session.userId, session.documentId);
    }
  }

  public getOrchestrator(documentId: number): DocumentOrchestrator | undefined {
    return this.documents.get(documentId);
  }

  
  private async flushDocumentToDatabase(documentId: number) {
    const orchestrator = this.documents.get(documentId);
    if (!orchestrator) return;

    const data = orchestrator.state;

    // Transaction batch update to PostgreSQL database
    await this.prisma.$transaction([
      this.prisma.documentBody.update({
        where: { privateDocumentId: documentId },
        data: { content: data.proofBox.content }
      }),
      this.prisma.document.update({
        where: { privateId: documentId },
        data: { status: data.proofBox.isLocked ? "INCOMPLETE" : "COMPLETE" }
      })
    ]);

    // Clean up memory space allocation
    this.documents.delete(documentId);
    console.log(`[Registry] Document ${documentId} committed to DB and cleared from RAM.`);
  }
}