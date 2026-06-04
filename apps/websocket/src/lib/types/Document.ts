
import { ProofStatus, ProofType, ProofTypeOrigin, Provability} from "@prove-it/db";
import { SelectedMathStatement, SelectedLemma, UserDefinedMathStatement } from "./MathStatements";
import { ErrorState } from "./Errors";


// ==== Document Information ====

export interface HotDocumentState{
  publicId: string;
  coursePublicId: string | null;
  title: string;
  status: ProofStatus;
  proofType: ProofType;
  proofTypeOrigin: ProofTypeOrigin;
  settings: ProofSettingState;
  /** User-defined statements on this document, keyed by `publicId` (resolve `SelectedMathStatement.ref`). */
  userDefinedMathStatements: Record<string, UserDefinedMathStatement>;

  // DocBody
  body: DocBodyState;
  question: QuestionState;
}

export interface ProofSettingState {
   isOpen: boolean;
   strictnessMathStatements: boolean; // When <true>, ML will use user-defined statements ONLY. When <false> ML is allowed to populate more math statements alongside user-defined statements.
   strictnessProofType: boolean; // When <true>, ML will use user-defined proof type ONLY. When <false> ML is allowed to change the proof type.
}

export interface Content{
  content: string;
  revision: number;
}
export interface DocBodyState extends Content{
  errors: ErrorState[]; 
}
export interface QuestionState extends Content {
  provability: Provability;
  selectedMathStatements: SelectedMathStatement[];
  selectedLemmas: SelectedLemma[];
}









