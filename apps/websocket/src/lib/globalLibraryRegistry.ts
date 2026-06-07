import { CourseLemma, CourseMathStatement } from "./types";

export class GlobalLibraryRegistry {
    /**
     * Stores course related information. Such as, math statements, lemmas, and textbook information
     * 
     * ==== Private Attributes ====
     * - #courseMathStatements: coursePublicId → statementPublicId → CourseMathStatement (catalog).
     * - #courseLemmas: coursePublicId → lemmaPublicId → CourseLemma (catalog).
     */
    
  #courseMathStatements = new Map<string, Map<string, CourseMathStatement>>();
  #courseLemmas = new Map<string, Map<string, CourseLemma>>();

  // Singleton instance
  private static _instance: GlobalLibraryRegistry | null = null;

  // TODO: Load from Prisma (privateOwnerId: null) per course
  public static async bootstrap(): Promise<GlobalLibraryRegistry> {
    /**
     * Load all math statements and lemmas from the database into the global library registry.
     */
    GlobalLibraryRegistry._instance = new GlobalLibraryRegistry();
    return Promise.resolve(GlobalLibraryRegistry._instance);
  }

  public static getMathStatement(coursePublicId: string, statementPublicId: string): CourseMathStatement | undefined {
    /**
     * Given <coursePublicId> and <statementPublicId>, return the corresponding math statement that belongs to such course.
     */
    if (!GlobalLibraryRegistry._instance) return undefined;
    return GlobalLibraryRegistry._instance.#courseMathStatements.get(coursePublicId)?.get(statementPublicId);
  }

  public static isCourseInLibraryRegistry(coursePublicId: string): boolean {
    /**
     * Check if <coursePublicId> is in the library registry. Return true if it is, false otherwise.
     */
    if (!GlobalLibraryRegistry._instance) return false;

    return GlobalLibraryRegistry._instance.#courseMathStatements.has(coursePublicId);
  }

  public static isLemmaInCourse(coursePublicId: string, lemmaPublicId: string): boolean {
    /**
     * Check if <lemmaPublicId> is in the course. Assume <coursePublicId> is valid and it exists in the library registry.
     * If true, then lemma is automatically in the library registry.
     */

    if (!GlobalLibraryRegistry._instance) return false;

    //Check if the lemma is in the library registry under <coursePublicId>
    return !GlobalLibraryRegistry._instance.#courseLemmas.get(coursePublicId)?.has(lemmaPublicId)
  }

  public static getLemma(coursePublicId: string, lemmaPublicId: string): CourseLemma | undefined {
    /**
     * Given <coursePublicId> and <lemmaPublicId>, return the corresponding lemma that belongs to such course.
     */
    if (!GlobalLibraryRegistry._instance) return undefined;
    return GlobalLibraryRegistry._instance.#courseLemmas.get(coursePublicId)?.get(lemmaPublicId);
  }

  // ==== FOR ML ====

  // TODO 
  public static getAllMathStatementsNamesFromCourse(coursePublicId: string): string[] {
    /**
     * Given <coursePublicId>, return all the names of the math statements that belong to such course.
     */
    if (!GlobalLibraryRegistry._instance) return [];
    return Array.from(GlobalLibraryRegistry._instance.#courseMathStatements.get(coursePublicId)?.keys() || []);
  }
}
