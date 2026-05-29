
import { ProofStatus, ProofType, Provability} from "@prove-it/db";
import { SelectedMathStatement, SelectedLemma } from "./MathStatements";
import { ErrorState } from "./Errors";


// ==== Document Information ====
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
   strictness: boolean; // When <true>, ML will use user-defined statements ONLY. When <false> ML is allowed to populate more math statements alongside user-defined statements.
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









