import { Socket } from 'socket.io';
import { GlobalLibraryRegistry } from '../lib/globalLibraryRegistry';
import { Registry } from '../lib/Registry';
import { ErrorState, HotDocumentState } from '../lib/types';
import { emitSocketError } from '../lib/emitSocketError';

export async function Join(clientSocket: Socket, registry: Registry, documentPublicId: string) {
    /**
     * Authorize the user to join the document and make edits.
     */

    const userPublicId = clientSocket.data.user?.publicId;
    if (!userPublicId) {
        emitSocketError(clientSocket, 'document:join:error', 'UNAUTHORIZED');
        return;
    }

    try {
        clientSocket.emit('document:join:processing', { documentId: documentPublicId });

        const { registered, message } = await registry.registerUser(
            clientSocket.id,
            userPublicId,
            documentPublicId,
        );

        if (!registered) {
            emitSocketError(clientSocket, 'document:join:error', message);
            clientSocket.disconnect(true);
            return;
        }

        clientSocket.join(`document-${documentPublicId}`);

        const workspace = registry.getWorkspaceBySocket(clientSocket.id);
        if (!workspace) {
            emitSocketError(clientSocket, 'document:join:error', 'INTERNAL_ERROR');
            clientSocket.disconnect(true);
            return;
        }

        clientSocket.emit(
            'document:join:success',
            buildJoinSuccessPayload(documentPublicId, workspace.orchestrator.getState()),
        );
    } catch (error) {
        console.error(`Unhandled join error for document ${documentPublicId}:`, error);
        emitSocketError(clientSocket, 'document:join:error', 'INTERNAL_ERROR');
    }
}

function buildJoinSuccessPayload(documentId: string, state: HotDocumentState) {
    /**
     * Build the payload for the join success event.
     */
    return {
        documentId,
        content: state.body.content,
        revision: state.body.revision,
        errors: state.body.errors.map(mapErrorForClient),
        questionContent: state.question.content,
        questionRevision: state.question.revision,
        mathStatements: mapMathStatementsForClient(state),
        proofType: state.proofType,
        coursePublicId: state.coursePublicId,
    };
}

function mapErrorForClient(error: ErrorState) { 
    /**
     * Map the error state to the client payload.
     */
    return {
        publicId: error.publicId,
        errorMessage: error.info.message,
        errortype: error.info.type,
        startIndexError: error.info.startIndex,
        endIndexError: error.info.endIndex,
        problematicContent: error.info.problematicContent,
        suggestion: error.suggestion
            ? {
                  suggestionContent: error.suggestion.content,
                  startIndexSuggestion: error.suggestion.startIndex,
                  endIndexSuggestion: error.suggestion.endIndex,
              }
            : null,
        MLTriggered: false,
    };
}

function mapMathStatementsForClient(state: HotDocumentState) {
    /**
     * Map the math statements to the client payload.
     */
    return state.question.selectedMathStatements.map((selected) => {
        if (selected.ref.source === 'user') {
            const userDefined = state.userDefinedMathStatements[selected.ref.publicId];
            return {
                publicId: selected.ref.publicId,
                type: userDefined?.information.type ?? selected.type,
                name: userDefined?.information.name ?? '',
                content: userDefined?.information.content ?? '',
                hint: '',
                textbook: null,
                orderIndex: null,
            };
        }

        const courseStatement =
            state.coursePublicId != null
                ? GlobalLibraryRegistry.getMathStatement(
                      state.coursePublicId,
                      selected.ref.publicId,
                  )
                : undefined;

        return {
            publicId: selected.ref.publicId,
            type: selected.type,
            name: courseStatement?.information.name ?? '',
            content: courseStatement?.information.content ?? '',
            hint: '',
            textbook: courseStatement?.textbook ?? null,
            orderIndex: courseStatement?.orderIndex ?? null,
        };
    });
}
