export class WorkspaceScheduler {
  // Key format: "documentId:timerType" (e.g., "102:autosave")
  private activeTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private onEvict: (docId: number) => Promise<void>,
    private onAutosave: (docId: number) => Promise<void>,
    private onMlTrigger: (docId: number) => Promise<void>
  ) {}

  private buildKey(docId: number, type: "grace" | "autosave" | "ml"): string {
    return `${docId}:${type}`;
  }

  // ==========================================
  // PROFILE 1: ONE-SHOT COUNTDOWNS (Disconnect Grace)
  // ==========================================
  public startGracePeriod(docId: number, durationMs = 30000) {
    const key = this.buildKey(docId, "grace");
    this.cancelTimer(docId, "grace");

    const timer = setTimeout(async () => {
      this.activeTimers.delete(key);
      // Clean up all other timers for this doc before evicting
      this.purgeAllTimersForDocument(docId);
      await this.onEvict(docId);
    }, durationMs);

    this.activeTimers.set(key, timer);
  }

  // ==========================================
  // PROFILE 2: INTERVAL HEARTBEATS (Autosave)
  // ==========================================
  public startAutosaveInterval(docId: number, intervalMs = 300000) { // 5 mins
    const key = this.buildKey(docId, "autosave");
    this.cancelTimer(docId, "autosave");

    const timer = setInterval(async () => {
      await this.onAutosave(docId);
    }, intervalMs);

    this.activeTimers.set(key, timer);
  }

  // ==========================================
  // PROFILE 3: SLIDING WINDOWS (ML Keystroke Debounce)
  // ==========================================
  public debounceMlTrigger(docId: number, delayMs = 1500) {
    const key = this.buildKey(docId, "ml");
    // Explicitly clears the previous typing timer so the window slides forward
    this.cancelTimer(docId, "ml"); 

    const timer = setTimeout(async () => {
      this.activeTimers.delete(key);
      await this.onMlTrigger(docId);
    }, delayMs);

    this.activeTimers.set(key, timer);
  }

  // ==========================================
  // INFRASTRUCTURE CLEANUP HELPERS
  // ==========================================
  public cancelTimer(docId: number, type: "grace" | "autosave" | "ml"): boolean {
    const key = this.buildKey(docId, type);
    const timer = this.activeTimers.get(key);
    if (timer) {
      // Handles both setTimeout and setInterval cleanly in Node
      clearTimeout(timer); 
      clearInterval(timer);
      this.activeTimers.delete(key);
      return true;
    }
    return false;
  }

  /**
   * The Ultimate Safety Switch: Call this when a document is closed or evicted 
   * to guarantee absolutely ZERO memory leaks.
   */
  public purgeAllTimersForDocument(docId: number) {
    this.cancelTimer(docId, "grace");
    this.cancelTimer(docId, "autosave");
    this.cancelTimer(docId, "ml");
    console.log(`[Scheduler] All background timers destroyed for document ${docId}`);
  }
}