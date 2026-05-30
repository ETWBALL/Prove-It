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

/**
 * Send a Socket.IO event to every client in `document-${documentPublicId}`.
 * Created once in server.ts; Registry binds documentPublicId per workspace.
 */
export type BroadcastToDocument = (
  eventName: string,
  documentPublicId: string,
  payload: unknown,
) => void;

/**
 * documentPublicId already bound (Option A). Used by DocumentOrchestrator only.
 */
export type EmitToDocument = (eventName: string, payload: unknown) => void;

export const DOCUMENT_STATE_UPDATED_EVENT = "document:state:updated";
export const DOCUMENT_ANALYSIS_STATUS_EVENT = "document:analysis:status";
