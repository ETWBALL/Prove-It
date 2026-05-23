import { HotDocumentState } from "./shared-types";
import { MlTriggerManager } from "./MlTriggerManager";
import { ProofType, ProofStatus } from "@prisma/client";

export class DocumentOrchestrator {
  public state: HotDocumentState;
  private mlManager: MlTriggerManager;
  private onStateBroadcast: (state: HotDocumentState) => void;

  constructor(initialData: any, broadcastCallback: (state: HotDocumentState) => void) {
    this.onStateBroadcast = broadcastCallback;
    this.mlManager = new MlTriggerManager(initialData.privateId);
    
    // Initialize standard state format
    this.state = {
      documentId: initialData.privateId,
      question: { text: initialData.title || "", provability: "unchecked" },
      mathContext: {
        selectedStatements: new Map(),
        linkedLemmas: new Map(),
        sufficiency: "empty"
      },
      proofBox: {
        provingStatement: initialData.documentBody?.provingStatement || "",
        content: initialData.documentBody?.content || "",
        isLocked: true, // Evaluator will unlock if conditions match
        errors: []
      },
      proofSettings: {
        isOpen: false,
        selectedProofType: initialData.proofType || ProofType.DIRECT,
        proofTypeOrigin: "undetected"
      }
    };

    // Hydrate tables/maps passed from DB initialization
    if (initialData.usedLemmas) {
      for (const item of initialData.usedLemmas) {
        this.state.mathContext.linkedLemmas.set(item.privateLemmaId, {
          privateId: item.privateLemmaId,
          name: item.lemma.name,
          content: item.lemma.content,
          linkedDocumentId: item.lemma.privateDocumentId,
          status: item.lemmaStatus
        });
      }
    }
    
    this.evaluateSyncRules();
  }

  /**
   * Core state machine evaluator. Determines locks and statuses purely in RAM.
   */
  private evaluateSyncRules() {
    const questionText = this.state.question.text.trim();
    
    // Condition 1: Question text cannot be empty
    if (!questionText) {
      this.state.proofBox.isLocked = true;
      return;
    }

    // Condition 2: Check if any dependent child sub-proofs remain unproven
    let hasUnresolvedLemmas = false;
    for (const lemma of this.state.mathContext.linkedLemmas.values()) {
      if (lemma.status === ProofStatus.INCOMPLETE) {
        hasUnresolvedLemmas = true;
        break;
      }
    }

    if (hasUnresolvedLemmas) {
      this.state.proofBox.isLocked = true;
      return;
    }

    // Condition 3: Check context definition assertions
    if (this.state.mathContext.sufficiency === "insufficient") {
      this.state.proofBox.isLocked = true;
      return;
    }

    // If all invariants clear, unlock workspace
    this.state.proofBox.isLocked = false;
  }

  /**
   * Mutation: Rebuild text delta tracking string from websocket updates
   */
  public applyTextDelta(newText: string) {
    if (this.state.proofBox.isLocked) return;
    
    this.state.proofBox.content = newText;
    this.onStateBroadcast(this.state);

    // Queue logic validation engine with a sliding debounce window
    this.mlManager.triggerAsyncAnalysis(async (signal) => {
      // Simulate heavy AI pipeline payload analysis
      await new Promise((res) => setTimeout(res, 1000));
      if (signal.aborted) return;

      // Mutate properties based on model parsing outputs
      this.state.proofBox.errors = []; // mock zero failures
      this.onStateBroadcast(this.state);
    });
  }

  /**
   * Mutation: Trigger structural changes when a user targets changes to configurations
   */
  public toggleSettingsPanel(isOpen: boolean) {
    this.state.proofSettings.isOpen = isOpen;
    
    if (isOpen) {
      // Rule: Opening settings drops running evaluation instances instantly
      this.mlManager.cancelActiveAnalysis();
    } else {
      this.evaluateSyncRules();
    }
    
    this.onStateBroadcast(this.state);
  }

  /**
   * Cascade Mutation: Fired when an internal child document changes its own complete status
   */
  public updateChildLemmaStatus(lemmaId: number, status: ProofStatus) {
    const target = this.state.mathContext.linkedLemmas.get(lemmaId);
    if (target) {
      target.status = status;
      this.evaluateSyncRules();
      this.onStateBroadcast(this.state);
    }
  }
}