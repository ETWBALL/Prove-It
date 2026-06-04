import { GlobalLibraryRegistry } from "./globalLibraryRegistry";
import {
    CourseMathStatement,
    MathStatementInformation,
    MathStatementRef,
    UserDefinedMathStatement,
} from "./types";

export type ResolvedMathStatement = CourseMathStatement | UserDefinedMathStatement;

/**
 * Resolve catalog or document-owned statement content from a selection ref.
 * - `course` → GlobalLibraryRegistry by course + statement publicId
 * - `user` → document `userDefinedMathStatements` by publicId
 */
export function resolveMathStatement(
    ref: MathStatementRef,
    coursePublicId: string | null,
    userDefinedMathStatements: Record<string, UserDefinedMathStatement>,
): ResolvedMathStatement | undefined {
    if (ref.source === "course") {
        if (!coursePublicId) return undefined;
        return GlobalLibraryRegistry.getMathStatement(coursePublicId, ref.publicId);
    }
    return userDefinedMathStatements[ref.publicId];
}

export function resolveMathStatementInformation(
    ref: MathStatementRef,
    coursePublicId: string | null,
    userDefinedMathStatements: Record<string, UserDefinedMathStatement>,
): MathStatementInformation | undefined {
    return resolveMathStatement(ref, coursePublicId, userDefinedMathStatements)?.information;
}
