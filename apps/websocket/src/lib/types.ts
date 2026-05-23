import { DocumentOrchestrator } from "./documentOrchestrator";
import { Scheduler } from "./Scheduler";
import { Socket } from "socket.io";
import { ProofStatus, ProofType, Sufficiency, Provability} from "@prove-it/db";



// User information. Not authenticated
export interface User{
    publicId: string;
    sessionPublicId: string;
}

// ==== (1) Socket Information ====
// Socket with authenticated user information in the `data` property
export interface AuthenticatedSocket extends Socket {
  data: {
    user: User; 
  };
}

export interface AuthorizedSocket extends Socket {
  data: {
    user: User;
    // We attach these here to guarantee this socket has cleared the security gate!
    authorizedDocumentId: number;
    authorizedAt: Date;
  };
}


// ==== (2) Document Information ====


export interface HotDocumentState{
  title: string;
  coursePublicId: string | null;
  status: ProofStatus;
  proofType: ProofType;
  settings: ProofSettingState;

  // DocBody
  question: Question;
  content: Content;
}


// Stores all user settings for this document
export interface ProofSettingState {
   isOpen: boolean;
}



// ==== (3) Question and Content (DOCBODY) Information ====
// Question information
export interface Question {
  isComplete: boolean;
  provability: Provability;
  revision: number;
  sufficiency: Sufficiency;
  

  text: string;
  buffer: Delta[];
  currentStatements: MathStatement[];
  currentLemmas: ActiveLemma[];
}


export interface QuestionCanvasState {
  
}


// Math Statement information
export interface MathStatement {
  publicId: 
}



export interface DocumentSession {
  userId: string;
  joinedAt: Date;
}

export interface Buffer {
  content: string, 
  
}





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