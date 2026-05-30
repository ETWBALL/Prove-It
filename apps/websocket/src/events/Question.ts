import { Socket } from "socket.io";
import { Delta, WorkspaceEntry } from "../lib/types";

export function QuestionDelta(socket: Socket, workspaceEntry: WorkspaceEntry, delta: Delta) {
    /**
     * Store delta in doc state, persist to db, trigger provability if needed.
     */

    // (1) Apply delta

    // (3) After 50 deltas, persist to db

    // (4) call statechanges to put a timer on for provability trigger

}