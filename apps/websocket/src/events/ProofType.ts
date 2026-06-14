import { WorkspaceEntry } from "../lib/types/Other";
import { Socket } from "socket.io";
import { ProofType, ProofTypeOrigin } from "@prove-it/db";
export function ProofTypeUpdated(socket: Socket, workspace: WorkspaceEntry, proofType: ProofType) {
    /**
     * Update the proof type of the question. 
     */

    // (1) Idempotent: proof type already matches — sync client, no error.
    if (workspace.orchestrator.getProofType() === proofType) {
        workspace.orchestrator.broadcastDocumentState();
        return;
    }

    // (2) Change it
    workspace.orchestrator.updateProofType(proofType, ProofTypeOrigin.USER_SET);

    // (3) Broadcast the state for UI changes
    workspace.orchestrator.broadcastDocumentState();


}