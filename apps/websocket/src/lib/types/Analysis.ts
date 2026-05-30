/** Ephemeral ML pipeline phase (status bar); not persisted on HotDocumentState. */
export type AnalysisPhase =
  | "idle"
  | "checking"
  | "analyzing"
  | "aborted";

export interface AnalysisStatusPayload {
  phase: AnalysisPhase;
  runId: number;
}
