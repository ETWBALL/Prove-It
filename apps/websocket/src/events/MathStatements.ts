import { WorkspaceEntry, MathStatement} from "../lib/types";
import { Socket } from "socket.io";
import { GlobalLibraryRegistry } from "../lib/globalLibraryRegistry";
import { emitSocketError } from "../lib/emitSocketError";

const MATH_STATEMENT_ERROR = "document:mathStatement:error";

export function MathStatementAdded(socket: Socket, workspace: WorkspaceEntry, mathStatement: MathStatement) {
    /**
     * Add a math statement to the document state. Check if its a course or a user-defined math statement.
     * Assume the math statement is also added to the db. 
     */

    // (1) differentiate between user-defined and course math statements
    const mathStatementKind = mathStatement.kind;

    if (mathStatementKind === "user-defined") {
        // (2) check if the math statement is already in the document state
        if (workspace.orchestrator.isMathStatementInDocumentState(mathStatement)) {
            emitSocketError(socket, MATH_STATEMENT_ERROR, "ALREADY_IN_DOCUMENT");
            return;
        }
    }

    else if (mathStatementKind === "course") {
        // (2) Check if the course is in the library registry. May be an invalid course
        if (!GlobalLibraryRegistry.isCourseInLibraryRegistry(mathStatement.coursePublicId)) {
            emitSocketError(socket, MATH_STATEMENT_ERROR, "COURSE_NOT_IN_REGISTRY");
            return;
        }

        // (3) Check if the math statement is in the course. May be an invalid math statement that doesn't belong to any course.
        if (!GlobalLibraryRegistry.isMathStatementInCourse(mathStatement.coursePublicId, mathStatement.publicId)) {
            emitSocketError(socket, MATH_STATEMENT_ERROR, "NOT_IN_COURSE");
            return;
        }

        // (4) Check if the math statement is already in the document state
        if (workspace.orchestrator.isMathStatementInDocumentState(mathStatement)) {
            emitSocketError(socket, MATH_STATEMENT_ERROR, "ALREADY_IN_DOCUMENT");
            return;
        }
    }
    else {
        emitSocketError(socket, MATH_STATEMENT_ERROR, "INVALID_KIND");
        return;
    }


    // (2) Add the math statement to the document state
    workspace.orchestrator.addMathStatement(mathStatement);

    // (3) Broadcast the state for UI changes
    workspace.orchestrator.broadcastDocumentState();
}


export function MathStatementRemoved(socket: Socket, workspace: WorkspaceEntry, mathStatement: MathStatement) {
    /**
     * Remove a math statement from the document state.
     * Relock proof text box (so we can check if the question remains provable)
     * Broadcast state for UI changes
     * Check if the math statement is already removed (If the math statement is not there)
     * Evaluate strictness settings and update the proof text box if needed
     */

    // (1) Check if the math statement is in the document state
    const selectedMathStatement = workspace.orchestrator.getSelectedMathStatement(mathStatement.publicId);
    if (!selectedMathStatement) {
        emitSocketError(socket, MATH_STATEMENT_ERROR, "NOT_IN_DOCUMENT");
        return;
    }

    // (2) Remove the math statement from the document state
    workspace.orchestrator.deleteSelectedMathStatement(selectedMathStatement);

    // (3) Broadcast the state for UI changes
    workspace.orchestrator.broadcastDocumentState();
}
