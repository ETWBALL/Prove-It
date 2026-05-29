import { CourseMathStatement, CourseLemma } from "./types/MathStatements";


export class GlobalLibraryRegistry {
    /**
     * Stores course related information. Such as, math statements, lemmas, and textbook information
     * 
     * ==== Private Attributes ====
     * - #courseMathStatements: (courseID, (textbookName, (mathStatementID, MathStatement))).
     * - #courseLemmas: (courseID, (textbookName, (lemmaID, Lemma))).
     */
    #courseMathStatements: Map<string, Map<string, Map<string, CourseMathStatement[]>>>; 
    #courseLemmas: Map<string, Map<string, Map<string, CourseLemma[]>>>; 

    // TODO: For each course, populate the attributes above
    public static async bootstrap(): Promise<GlobalLibraryRegistry> {
        /**
         * Populate the course and lemmas from the database.
         */
        return new GlobalLibraryRegistry()
    }

    public static getMathStatement(courseId: string, mathStatementId: string): CourseMathStatement | undefined {
        /**
         * Get a math statement given a courseId and mathStatementId. Return undefined if not found.
         */
        return this.#courseMathStatements.get(courseId)?.get(mathStatementId);
    }

    public static getLemma(courseId: string, lemmaId: string): CourseLemma | undefined {
        /**
         * Get a lemma given a courseId and lemmaId. Return undefined if not found.
         */
        return this.#courseLemmas.get(courseId)?.get(lemmaId);
    }
}