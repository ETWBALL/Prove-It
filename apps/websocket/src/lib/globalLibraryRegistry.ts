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

  public static getLemma(coursePublicId: string, lemmaPublicId: string): CourseLemma | undefined {
    /**
     * Given <coursePublicId> and <lemmaPublicId>, return the corresponding lemma that belongs to such course.
     */
    if (!GlobalLibraryRegistry._instance) return undefined;
    return GlobalLibraryRegistry._instance.#courseLemmas.get(coursePublicId)?.get(lemmaPublicId);
  }
}
