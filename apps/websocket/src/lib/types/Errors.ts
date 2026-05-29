import { ValidationLayer, ErrorType} from "@prove-it/db";

// ==== Errors ====

export interface Suggestion {
    content: string;
    startIndex: number;
    endIndex: number;
}
export interface ErrorInformation{
    type: ErrorType;
    message: string;
    layer: ValidationLayer;
  
    problematicContent: string;
    startIndex: number;
    endIndex: number;
}
export interface ErrorState {
    publicId: string | undefined; 
    info: ErrorInformation;

    suggestion: Suggestion | undefined;

    resolvedAt: Date | null;
    dismissedAt: Date | null;
    isPendingReevaluation: boolean; // For errors that are resolved but need to be re-evaluated after a doc change


}