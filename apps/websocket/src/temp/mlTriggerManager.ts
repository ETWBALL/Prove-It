export class MlTriggerManager {
  private activeAnalysis: AbortController | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(private documentId: number) {}

  /**
   * Schedules a background evaluation request. If a user is actively typing,
   * it cancels previous pending executions to save computational capacity.
   */
  public triggerAsyncAnalysis(onExecute: (signal: AbortSignal) => Promise<void>, delayMs = 1500) {
    this.cancelActiveAnalysis();

    this.debounceTimer = setTimeout(async () => {
      this.activeAnalysis = new AbortController();
      try {
        await onExecute(this.activeAnalysis.signal);
      } catch (error: any) {
        if (error.name === "AbortError") {
          console.log(`[ML Engine] Analysis aborted for document ${this.documentId}`);
        } else {
          console.error(`[ML Engine] Pipeline error on doc ${this.documentId}:`, error);
        }
      } finally {
        this.activeAnalysis = null;
      }
    }, delayMs);
  }

  /**
   * Instantly stops any running network operations (e.g., if proof settings panel opens)
   */
  public cancelActiveAnalysis() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.activeAnalysis) {
      this.activeAnalysis.abort();
      this.activeAnalysis = null;
    }
  }
}