import { WorkspaceEntry } from "../../lib/types/Other";
import { Socket } from "socket.io";
import { MathStatement } from "../../lib/types/MathStatements";

export function MathStatementAdded(socket: Socket, workspace: WorkspaceEntry, mathStatement: MathStatement) {
    /**
     * Add a math statement to the document state. Check if its a course or a user-defined math statement.
     * Relock proof text box (so we can check if the question remains provable)
     * Broadcast state for UI changes
     * ALso dont forget to validate the math statement payload
     * Check for idempotent adds (If the math statement is already there)
     * Evaluate strictness settings and update the proof text box if needed
     * 
     */

    // TODO
}

// TODO should the payload be a huge object or just the publicId?

export function MathStatementRemoved(socket: Socket, workspace: WorkspaceEntry, mathStatement: MathStatement) {
    /**
     * Remove a math statement from the document state.
     * Relock proof text box (so we can check if the question remains provable)
     * Broadcast state for UI changes
     * Check if the math statement is already removed (If the math statement is not there)
     * Evaluate strictness settings and update the proof text box if needed
     */

    // TODO
}