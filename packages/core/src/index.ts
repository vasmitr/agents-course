import { merge, tap } from "rxjs";
import { createAgentLoop$, createToolLoop$ } from "./loops.js";
import { state$, postMessage } from "./store.js";
import { fetchOllama$ } from "./model.js";

export const core$ = merge(
  createAgentLoop$(state$, fetchOllama$),
  createToolLoop$(state$)
).pipe(tap(postMessage));

export * from "./store.js";
export * from "./types.js";
