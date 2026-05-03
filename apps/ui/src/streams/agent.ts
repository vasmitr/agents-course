import { filter, finalize, merge, take, takeUntil, tap, switchMap, Observable } from "rxjs";
import { COLORS } from "../colors.js";

export function getAgentStream(
  thinking$: Observable<string>,
  writing$: Observable<string>,
  turnStart$: Observable<unknown>,
  turnEnd$: Observable<unknown>,
  onTurnEnd: () => void
) {
  const thinkingStream$ = turnStart$.pipe(
    switchMap(() =>
      thinking$.pipe(
        takeUntil(writing$.pipe(filter((t) => !!t), take(1))),
        tap((tokens) => process.stdout.write(`${COLORS.dim}${tokens}`)),
        finalize(() => process.stdout.write(`\n\n${COLORS.white}Agent is typing...\n`))
      )
    )
  );

  const writingStream$ = turnStart$.pipe(
    switchMap(() =>
      writing$.pipe(
        takeUntil(turnEnd$),
        tap((tokens) => process.stdout.write(`${COLORS.blue}${tokens}`)),
        finalize(() => {
          process.stdout.write("\n\n");
          onTurnEnd();
        })
      )
    )
  );

  return merge(thinkingStream$, writingStream$);
}
