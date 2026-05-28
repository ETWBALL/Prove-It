import { Socket } from "socket.io";
import { Registry } from "../lib/Registry";
import { AuthenticatedSocket, Delta } from "../lib/types";

export function QuestionDelta(clientSocket: AuthenticatedSocket, registry: Registry, delta: Delta) {
    /**
     * Store delta in doc state, persist to db, trigger provability if needed.
     */

    // (1) Apply delta

    // (2) Set up db timer

    // (3) After 50 deltas, persist to db

    // (4) call statechanges to put a timer on for provability trigger

}