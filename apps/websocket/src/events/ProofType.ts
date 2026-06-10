import { WorkspaceEntry } from "../lib/types/Other";
import { Socket } from "socket.io";
import { ProofType, ProofTypeOrigin } from "@prove-it/db";
import { emitSocketError } from "../lib/emitSocketError";
export function ProofTypeUpdated(socket: Socket, workspace: WorkspaceEntry, proofType: ProofType) {
    /**
     * Update the proof type of the question. 
     */

    // (1) first, check if the proof type is already set as requested.
    if (workspace.orchestrator.getProofType() === proofType) {
        emitSocketError(socket, "document:proofType:error", "PROOF_TYPE_ALREADY_SET");
        return;
    }

    // (2) Change it
    workspace.orchestrator.updateProofType(proofType, ProofTypeOrigin.USER_SET);

    // (3) Broadcast the state for UI changes
    workspace.orchestrator.broadcastDocumentState();


}