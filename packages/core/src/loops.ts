import {
  catchError,
  concatMap,
  filter,
  finalize,
  from,
  of,
  map,
  reduce,
  tap
} from "rxjs";
import {
  executeTool$,
  extractToolCallsFromMessage,
  getToolByCall,
  parseCall,
  processToolCallMatches,
  validateToolArgs
} from "./helpers/tools.js";
import {
  cleanupStreamTokens,
  state$,
  streamResponseTokens,
  postMessage
} from "./store.js";
import { buildContext } from "./helpers/context.js";
import { fetchOllama$ } from "./model.js";

export const agentLoop$ = state$.pipe(
  filter((state) =>
    ["user", "tool"].includes(state.history.at(-1)?.role || "")
  ),
  // Process history into context
  map((state) => buildContext(state.history)),
  // For each user message found, call LLM
  concatMap((context) => {
    return fetchOllama$(context).pipe(
      // Stream tokens for UI
      tap(streamResponseTokens),
      finalize(cleanupStreamTokens),
      // Build finalMessage from response tokens
      reduce((acc, res) => acc + res.content, ""),
      tap((finalMessage) =>
        postMessage({
          role: "agent",
          content: finalMessage
        })
      )
    );
  })
);

export const toolLoop$ = state$.pipe(
  filter((state) => state.history.at(-1)?.role === "agent"),
  map((state) => state.history.at(-1)!.content),
  concatMap((content) => from(extractToolCallsFromMessage(content))),
  map(processToolCallMatches),
  concatMap((jsonStr) =>
    of(jsonStr).pipe(
      map(parseCall),
      map(getToolByCall),
      map(validateToolArgs),
      concatMap(executeTool$),
      catchError((err) =>
        of({
          role: "tool" as const,
          content: JSON.stringify(err || {})
        })
      )
    )
  ),
  tap(postMessage)
);
