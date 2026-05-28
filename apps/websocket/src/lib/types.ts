import { DocumentOrchestrator } from "./documentOrchestrator";
import { Scheduler } from "./Scheduler";
import { Socket } from "socket.io";
import { ProofStatus, ProofType, Sufficiency, MathStatement, Library, Provability, ValidationLayer, ErrorType} from "@prove-it/db";




// ==== (1) Socket Information ====

export interface User{
    publicId: string;
    sessionPublicId: string;
}
export interface AuthenticatedSocket extends Socket {
  data: {
    user: User; 
  };
}
export interface AuthorizedSocket extends Socket {
  data: {
    user: User;
    // We attach these here to guarantee this socket has cleared the security gate!
    authorizedDocumentId: string;
    authorizedAt: Date;
  };
}




// ==== (2) Document Information ====
export interface HotDocumentState{
  publicId: string;
  coursePublicId: string | null;
  title: string;
  status: ProofStatus;
  provability: Provability;
  proofType: ProofType;
  settings: ProofSettingState;

  // DocBody
  body: DocBodyState;
  question: QuestionState;
}
export interface ProofSettingState {
   isOpen: boolean;
}
export interface Content{
  content: string;
  revision: number;
}
export interface DocBodyState extends Content{
  errors: ErrorState[]; 
}
export interface QuestionState extends Content {
  selectedMathStatements: SelectedMathStatement[];
  selectedLemmas: SelectedLemma[];
}
export interface Suggestion {
  content: string;
  startIndex: number;
  endIndex: number;
}
export interface ErrorInformation{
  errorType: ErrorType;
  message: string;
  layer: ValidationLayer;

  problematicContent: string;
  startIndex: number;
  endIndex: number;
}
export interface ErrorState {
  publicId: string | undefined; 
  info: ErrorInformation;

  suggestion: Suggestion | undefined;

  resolvedAt: Date | null;
  dismissedAt: Date | null;
  isPendingReevaluation: boolean; // For errors that are resolved but need to be re-evaluated after a doc change


}
export interface DocumentSession {
  userId: string;
  joinedAt: Date;
}






// ==== (3) Math Statement information ====

// Every statement selected in a document needs tracking metadata, regardless of origin.
interface BaseSelectedStatement {
    hintContent: string | null;
    wasUsed: boolean;
    sufficient: Sufficiency; 
    resolvedAt: Date | null;
    dismissedAt: Date | null;
}
export interface CourseMathStatement extends BaseSelectedStatement {
    origin: 'course';
    textbook: string;
    orderIndex: number;
    publicId: string; // Corresponds to the publicId in the MathStatement table
}
export interface UserDefinedMathStatement extends BaseSelectedStatement {
    origin: 'user';
    publicId: string | undefined; // Optional, as user-defined statements may not have a publicId until persisted
    name: string;
    type: Library;
    content: string;
}
export type SelectedMathStatement = CourseMathStatement | UserDefinedMathStatement;





// ==== (4) Lemma Information ====
interface BaseSelectedLemma {
  documentId: string;
  lemmaStatus: ProofStatus;
  lemmaManualOverride: boolean; // Users may not want to prove this statement
}
export interface CourseLemma extends BaseSelectedLemma {
  origin: 'course';
  textbook: string;
  orderIndex: number;
  publicId: string; // Corresponds to the publicId in the Lemma table
}
export interface UserDefinedLemma extends BaseSelectedLemma {
  origin: 'user';
  publicId: string | undefined; // Optional, as user-defined lemmas may not have a publicId until persisted
  name: string;
  content: string;
}
export type SelectedLemma = CourseLemma | UserDefinedLemma;



// ==== (5) Deltas ====
// Base properties every single delta must have

export type Target = 'question' | 'content';
interface BaseDelta {
    target: Target;
    id: string;               // UUID for idempotency (prevents double-processing)
    documentId: string;
    revision: number;         // For strict ordering
    timestamp: number;        // Epoch time for auditing/latency tracking
}
export interface InsertDelta extends BaseDelta {
    type: 'insert';
    index: number;            // Inserts only need one index
    content: string;
}
export interface DeleteDelta extends BaseDelta {
    type: 'delete';
    startIndex: number;
    endIndex: number;
}
export interface ReplaceDelta extends BaseDelta {
    type: 'replace';
    startIndex: number;
    endIndex: number;
    content: string;
}
export type Delta = InsertDelta | DeleteDelta | ReplaceDelta; 





// ==== (6) Other ====
// DocumentSessionRegistry: Information about a user's document information per socket
export interface WorkspaceEntry {
  orchestrator: DocumentOrchestrator;
  session: DocumentSession;
  activeSockets: Set<string>; 
}
// Information to send in every emit to clients.
export interface Messenger {
    broadcastToDocument: (eventName: string, documentId: number, payload: any) => void;
}
