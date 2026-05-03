import { filter, finalize, merge, take, takeUntil, tap, switchMap, Subject } from "rxjs";
import { thinkingSubject$, writingSubject$ } from "@packages/core";
import { onMessage$ } from "@packages/core/helpers";
import { UIState, ChatMode } from "../types.js";
import { COLORS } from "../colors.js";

export function getAgentStream(
  state$: Subject<UIState>,
  getChatState: () => ChatMode
) {
  const turnStart$ = merge(onMessage$("user"), onMessage$("tool"));
  const turnEnd$ = onMessage$("agent");

  const thinking$ = turnStart$.pipe(
    switchMap(() =>
      thinkingSubject$.pipe(
        takeUntil(writingSubject$.pipe(filter((t) => !!t), take(1))),
        tap((tokens) => process.stdout.write(`${COLORS.dim}${tokens}`)),
        finalize(() => process.stdout.write(`\n\n${COLORS.white}Agent is typing...\n`))
      )
    )
  );

  const writing$ = turnStart$.pipe(
    switchMap(() =>
      writingSubject$.pipe(
        takeUntil(turnEnd$),
        tap((tokens) => process.stdout.write(`${COLORS.blue}${tokens}`)),
        finalize(() => {
          process.stdout.write("\n\n");
          state$.next(getChatState());
        })
      )
    )
  );

  return merge(thinking$, writing$);
}
