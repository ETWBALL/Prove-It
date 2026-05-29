import type { DocumentOrchestrator } from "../documentOrchestrator";

// ==== Registry / workspace ====

export interface DocumentSession {
  documentPublicId: string;
  userId: string;
  joinedAt: Date;
}

export interface WorkspaceEntry {
  orchestrator: DocumentOrchestrator;
  session: DocumentSession;
  /** The socket currently allowed to mutate this document (one tab enforced). */
  socketId: string;
  /** Socket ids seen for this doc; used on join to find and disconnect duplicate tabs. */
  registeredSocketIds: Set<string>;
}

export interface BroadcastToDocument {
  (
    eventName: string,
    documentPublicId: string,
    payload: unknown
  ): void;
}

export interface Messenger {
  broadcastToDocument: BroadcastToDocument;
}
