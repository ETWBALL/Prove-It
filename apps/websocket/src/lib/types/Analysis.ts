/**
 * Ephemeral phase of the ML / provability pipeline. Sent on `document:analysis:status`
 * for the client status bar only — not stored on HotDocumentState.
 *
 * - `idle`: No run in progress (or finished).
 * - `checking`: Server is evaluating gates before calling ML.
 * - `analyzing`: Gates passed; ML HTTP request in flight.
 * - `aborted`: Run was cancelled (settings opened, new delta, newer run started, etc.).
 */
export type AnalysisPhase =
  | "idle"
  | "checking"
  | "analyzing"
  | "aborted";

/**
 * Payload for `document:analysis:status`.
 *
 * - `phase`: What to show in the status bar (see AnalysisPhase).
 * - `runId`: Monotonic id per document workspace. Client should ignore events whose
 *   `runId` is older than the latest `runId` it has seen (avoids stale loading UI).
 */
export interface AnalysisStatusPayload {
  phase: AnalysisPhase;
  runId: number;
}
