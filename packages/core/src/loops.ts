import {
  catchError,
  concatMap,
  filter,
  finalize,
  from,
  of,
  map,
  reduce,
  tap,
  Observable
} from "rxjs";
import {
  executeTool$,
  extractToolCallsFromMessage,
  getToolByCall,
  parseCall,
  processToolCallMatches,
  validateToolArgs
} from "./helpers/tools.js";
import { cleanupStreamTokens, streamResponseTokens } from "./store.js";
import { buildContext } from "./helpers/context.js";
import { BaseMessage, ModelPartialUpdate, State } from "./types.js";

export const createAgentLoop$ = (
  state$: Observable<State>,
  fetchModel$: (ctx: string) => Observable<ModelPartialUpdate>
): Observable<BaseMessage> =>
  state$.pipe(
    filter((state) =>
      ["user", "tool"].includes(state.history.at(-1)?.role || "")
    ),
    map((state) => buildContext(state.history)),
    concatMap((context) =>
      fetchModel$(context).pipe(
        tap(streamResponseTokens),
        finalize(cleanupStreamTokens),
        reduce((acc, res) => acc + res.content, ""),
        map((content) => ({ role: "agent" as const, content }))
      )
    )
  );

export const createToolLoop$ = (
  state$: Observable<State>
): Observable<BaseMessage> =>
  state$.pipe(
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
            content: err.message
          })
        )
      )
    )
  );
