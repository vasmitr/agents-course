import { buffer, bufferTime, filter, map, Observable, switchMap, tap } from "rxjs";
import { postMessage } from "@packages/core";
import { UIState } from "../types.js";
import { COLORS } from "../colors.js";
import readline from "node:readline/promises";

export function getInputStreamStream(
  input$: Observable<string>,
  state$: Observable<UIState>,
  rl: readline.Interface
) {
  const done$ = input$.pipe(
    bufferTime(500),
    filter((lines) => lines.length > 0 && lines.at(-1)?.trim() === "")
  );

  return state$.pipe(
    switchMap((state) => {
      rl.setPrompt(state.prompt);
      rl.prompt();

      return input$.pipe(
        tap(() => process.stdout.write(`${COLORS.dim}...\n${COLORS.white}`)),
        buffer(done$),
        map((msg) => msg.join("\n")),
        tap((content) => {
          postMessage({ role: "user", content });
          process.stdout.write(`${COLORS.white}Agent is thinking...\n`);
        })
      );
    })
  );
}
