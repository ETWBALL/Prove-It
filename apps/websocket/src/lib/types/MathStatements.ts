import { Sufficiency, Library, ProofStatus, Textbook} from "@prove-it/db";

// TODO: When the user selects either course statements or user-defined math statements, you want to send the public ID, or maybe even send the entire math statement, over to the web socket. If the user were to create an entirely new definition or new level on the front end, we'll need to do a post that creates an entirely new math statement. When that returns a new public ID, we need to send that public ID along with the math statement over to the web socket. That way, the document-only math statements, or specifically the user-defined math statements, will have a public ID as always.

// ==== Math Statement information ====

// Core Math Statement Information
export interface Information {
  content: string;
  name: string;
  type: Library;
}


// ONLY <globalLibraryRegistry> is allowed to store this
export interface CourseMathStatement extends Information {
  textbook: Textbook | null;
  orderIndex: number | null;
  
}


// Document-owned definitions (not in registry)
export interface UserDefinedMathStatement extends Information {
  publicId: string;        
}

/** Junction row: links a document to a statement via `ref`; resolve `information` through the ref. */
export interface SelectedMathStatement {
  /** Prisma `Library` kind (definition, theorem, axiom, …). */
  type: Library;
  hintContent: string | null;
  wasUsed: boolean;
  sufficient: Sufficiency;
  resolvedAt: Date | null;
  dismissedAt: Date | null;

  ref: MathStatementRef;
}

export type MathStatement = CourseMathStatement | UserDefinedMathStatement;

export type MathStatementRef =
  | { source: "course"; publicId: string }
  | { source: "user"; publicId: string };


  
// ==== Lemma information ====
interface LemmaInformation {
  kind:     'course' | 'user-defined';  // ← the discriminant
  content: string;
  name: string;
  publicId: string;
}

// ONLY <globalLibraryRegistry> is allowed to store this
export interface CourseLemma extends LemmaInformation {
  kind:       'course';
  textbook: Textbook | null;
  orderIndex: number | null;
  coursePublicId: string;
}

// Document-owned definitions (not in registry)
export interface UserDefinedLemma extends LemmaInformation {
  kind:       'user-defined';
}

export type Lemma = CourseLemma | UserDefinedLemma;

export type LemmaRef = {
  source:   Lemma['kind'];   // 'course' | 'user-defined' — always in sync
  publicId: string;
};


// What the document state stores:
export interface SelectedLemma {
  lemmaStatus: ProofStatus;
  lemmaManualOverride: boolean;
  ref: LemmaRef;
}