import { WorkspaceEntry } from "../../lib/types/Other";
import { Socket } from "socket.io";
import { ProofType } from "@prove-it/db";




export function ProofTypeUpdated(socket: Socket, workspace: WorkspaceEntry, proofType: ProofType) {
    /**
     * Update the proof type of the question.
     * Relock proof text box (so we can check if the question remains provable)
     * Broadcast state for UI changes
     * Check for strictness
     * And for other wierd cases
     * Check if the proof type is cleared vs populated (different prompts)
     * 
     */

    // TODO
}