import { ProofType, ProofStatus, Library, Sufficiency, ValidationLayer } from "@prisma/client";

export interface DocumentSession {
  socketId: string;
  userId: number;
  documentId: number;
  joinedAt: Date;
}

export interface HotDocumentState {
  documentId: number;
  question: {
    text: string;
    provability: "unchecked" | "provable" | "unprovable";
  };
  mathContext: {
    selectedStatements: Map<number, {
      privateId: number;
      name: string;
      type: Library;
      content: any;
      source: "ml_detected" | "user_added";
      sufficiency: Sufficiency;
    }>;
    linkedLemmas: Map<number, {
      privateId: number;
      name: string;
      content: any;
      linkedDocumentId: number | null;
      status: ProofStatus;
    }>;
    sufficiency: "empty" | "loading" | "insufficient" | "sufficient";
  };
  proofBox: {
    provingStatement: string;
    content: string; 
    isLocked: boolean; 
    errors: Array<{
      privateId?: number;
      startIndexError: number;
      endIndexError: number;
      errortype: string;
      layer: ValidationLayer;
    }>;
  };
  proofSettings: {
    isOpen: boolean;
    selectedProofType: ProofType;
    proofTypeOrigin: "undetected" | "ml_detected" | "user_set";
  };
}