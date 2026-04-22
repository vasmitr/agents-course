import Rx from "rxjs";
import {
  activeContentSubject$,
  postMessage,
  state$,
  thinkingSubject$
} from "@packages/core";
import readline from "node:readline/promises";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const input$ = Rx.fromEvent<string>(rl, "line");

const done$ = input$.pipe(
  Rx.bufferTime(100), // Handle paste
  Rx.filter((lines) => lines.at(-1)?.trim() === "") // handle double RETURN
);

input$
  .pipe(
    Rx.buffer(done$),
    Rx.map((msg: string[]) => msg.join("\n")),
    Rx.tap((content: string) => {
      postMessage({
        role: "user",
        content
      });
      rl.prompt();
    })
  )
  .subscribe();

rl.setPrompt("\x1b[32m>>> ");
rl.prompt();

thinkingSubject$.pipe(Rx.takeWhile((tokens) => !!tokens)).subscribe({
  next: (tokens) => process.stdout.write(`\x1b[37m${tokens}`),
  complete: () => process.stdout.write("\x1b[37m\n*Thought for a while*\n")
});

activeContentSubject$
  .pipe(
    Rx.takeUntil(
      state$.pipe(
        Rx.filter((state) => state.history.at(-1)?.role === "agent"),
        Rx.take(1),
        Rx.distinctUntilChanged()
      )
    )
  )
  .subscribe({
    next: (tokens) => process.stdout.write(`\x1b[34m${tokens}`),
    complete: () => {
      process.stdout.write(`\x1b[34m\n${"=".repeat(process.stdout.columns)}\n`);
      rl.prompt();
    }
  });
