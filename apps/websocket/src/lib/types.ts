export interface DocumentState {
    questionContent: string,
    questionRevision: number,
    questionBuffer: Delta[],
    content: string,
    contentId: string,
    revision: number, // The current revision (or at the end of the buffer array). Helps for syncing server side document and the client side document
    buffer: Delta[],
    errors: ErrorState[],
    coursePublicId: string | null,
    proofType: ProofType | null
    selectedMathStatements: MathStatements[] | null
}



export interface Document {
  documentId:       string
  parentDocumentId: string | null
  parentLemmaId:    string | null
  courseId:         string | null
  question:         Question
  proof:            Proof
  lemmas:           Lemma[]
  mathContext:      MathContext
  proofSettings:    ProofSettings
  courseLibrary:    MathStatement[]   // loaded on join, read only
  userDefinitions:  MathStatement[]   // loaded on join, user's saved definitions
}