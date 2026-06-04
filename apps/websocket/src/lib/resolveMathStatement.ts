import { GlobalLibraryRegistry } from "./globalLibraryRegistry";
import {
    CourseMathStatement,
    MathStatementRef,
    UserDefinedMathStatement,
} from "./types";

export type ResolvedMathStatement = CourseMathStatement | UserDefinedMathStatement;

/**
 * Resolve catalog or document-owned statement content from a selection ref.
 * - `course` → GlobalLibraryRegistry by course + statement publicId
 * - `user` → document `userDefinedMathStatements` by publicId
 */
export function resolveMathStatement(ref: MathStatementRef, coursePublicId: string | null, userDefinedMathStatements: Record<string, UserDefinedMathStatement>): ResolvedMathStatement | undefined {
    /**
     * Resolve the math statement from the course catalog or the document's user-defined math statements.
     */

    // (1) Resolve the math statement from the course catalog
    if (ref.source === "course") {
        if (!coursePublicId) return undefined;
        return GlobalLibraryRegistry.getMathStatement(coursePublicId, ref.publicId);
    }
    return userDefinedMathStatements[ref.publicId];
}
