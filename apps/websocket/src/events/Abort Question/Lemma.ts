import { WorkspaceEntry } from "../../lib/types/Other";
import { Socket } from "socket.io";
import { Lemma } from "../../lib/types/MathStatements";
import { GlobalLibraryRegistry } from "../../lib/globalLibraryRegistry";


export function LemmaAdded(workspace: WorkspaceEntry, lemma: Lemma) {
    /**
     * Relock proof text box (so we can check if the question remains provable)
     * Broadcast state for UI changes
     */     

    // (1) Differentiate between user-defined and course lemmas

    const lemmaOrigin = lemma.kind;

    if (lemmaOrigin === "user-defined") {

        // (2) Check if the lemma is already in the document state
        if (workspace.orchestrator.isLemmaInDocumentState(lemma)) {
            throw new Error(`Lemma ${lemma.publicId} already in document state.`);
        }

    }

    else if (lemmaOrigin === "course") {
        // (2) Check if the course is in the library registry. May be an invalid course
        if (!GlobalLibraryRegistry.isCourseInLibraryRegistry(lemma.coursePublicId)) {
            throw new Error(`Course ${lemma.coursePublicId} not found in library registry. Please add a valid course first.`);
        }

        // (3) Check if the lemma is in the course. May be an invalid lemma that doesn't belong to any course.
        if (!GlobalLibraryRegistry.isLemmaInCourse(lemma.coursePublicId, lemma.publicId)) {
            throw new Error(`Lemma ${lemma.publicId} not found in course ${lemma.coursePublicId}.`);
        }


        // (4) Check if the lemma is already in the document state
        if (workspace.orchestrator.isLemmaInDocumentState(lemma)) {
            throw new Error(`Lemma ${lemma.publicId} already in document state.`);
        }

    }
    else {
        throw new Error("Invalid lemma origin");
    }

    // (2) Add the lemma to the document state
    workspace.orchestrator.addLemma(lemma);


    // (3) Start the lemma timer. Lemma was just added to the document state.
    workspace.orchestrator.startLemmaTimer();

    // (4) Broadcast the state for UI changes
    workspace.orchestrator.broadcastDocumentState();

}

export function LemmaRemoved(socket: Socket, workspace: WorkspaceEntry, lemma: Lemma) {
    /**
     * Remove a lemma from the document state.
     */
    
    // (1) First check if the lemma is in the document state
    const selectedLemma = workspace.orchestrator.getSelectedLemma(lemma.publicId);
    if (!selectedLemma) {
        throw new Error(`Lemma ${lemma.publicId} not found in document state. Please provide a valid lemma.`);
    }
    // (2) Remove the lemma from the document state
    workspace.orchestrator.deleteSelectedLemma(selectedLemma);

    // (3) Check if you can stop the lemma timer.
    if (workspace.orchestrator.canStopLemmaTimer()) {
        workspace.orchestrator.stopLemmaTimer();
    }

    // (4) Broadcast the state for UI changes
    workspace.orchestrator.broadcastDocumentState();

}