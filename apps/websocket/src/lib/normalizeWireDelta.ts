import { randomUUID } from "crypto";
import type { Delta, Target } from "./types";

/** Legacy editor wire payload — uses `startIndex` for inserts; maps to {@link Delta}. */
export type WireDeltaPayload = {
    type: "insert" | "delete" | "replace";
    documentId: string;
    startIndex: number;
    endIndex: number;
    content: string;
    revision: number;
    id?: string;
    timestamp?: number;
};

export function normalizeWireDelta(payload: WireDeltaPayload, target: Target): Delta {
    const base = {
        target,
        documentId: payload.documentId,
        revision: payload.revision,
        id: payload.id ?? randomUUID(),
        timestamp: payload.timestamp ?? Date.now(),
    };

    switch (payload.type) {
        case "insert":
            return { ...base, type: "insert", index: payload.startIndex, content: payload.content };
        case "delete":
            return { ...base, type: "delete", startIndex: payload.startIndex, endIndex: payload.endIndex };
        case "replace":
            return {
                ...base,
                type: "replace",
                startIndex: payload.startIndex,
                endIndex: payload.endIndex,
                content: payload.content,
            };
    }
}
