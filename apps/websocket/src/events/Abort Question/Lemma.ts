import { WorkspaceEntry } from "../../lib/types/Other";
import { Socket } from "socket.io";
import { Lemma } from "../../lib/types/MathStatements";


export function LemmaAdded(socket: Socket, workspace: WorkspaceEntry, lemma: Lemma) {
    /**
     * Add a lemma to the document state. Check if its a course or a user-defined lemma.
     * Relock proof text box (so we can check if the question remains provable)
     * Broadcast state for UI changes
     * ALso dont forget to validate the lemma payload
     * Check for idempotent adds (If the lemma is already there)
     * Set up the lemma timer to check for completeness
     * 
     */

    // TODO
}

// TODO should the payload be a huge object or just the publicId?

export function LemmaRemoved(socket: Socket, workspace: WorkspaceEntry, lemma: Lemma) {
    /**
     * Remove a lemma from the document state.
     * Relock proof text box (so we can check if the question remains provable)
     * Broadcast state for UI changes
     * Check if the lemma is already removed (If the lemma is not there)
     * Pause the timer if this is the last lemma
     */

    // TODO
}