import {
  buffer,
  bufferTime,
  defer,
  filter,
  finalize,
  fromEvent,
  map,
  merge,
  switchMap,
  take,
  takeUntil,
  tap
} from "rxjs";
import {
  writingSubject$,
  postMessage,
  thinkingSubject$,
  onMessage$
} from "@packages/core";
import readline from "node:readline/promises";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const input$ = fromEvent<string>(rl, "line");

const done$ = input$.pipe(
  bufferTime(500), // Handle paste
  filter((lines) => lines.at(-1)?.trim() === "") // handle double RETURN
);

defer(() => {
  rl.setPrompt("\x1b[38;5;46m>>> \x1b[38;5;255m");
  rl.prompt();
  return input$.pipe(
    tap(() => {
      process.stdout.write("\x1b[37m...\n\x1b[38;5;255m");
    }),
    buffer(done$),
    map((msg: string[]) => msg.join("\n")),
    tap((content: string) => {
      postMessage({
        role: "user",
        content
      });
      process.stdout.write("\x1b[38;5;255mAgent is thinking...\n");
    })
  );
}).subscribe();

const turnStart$ = merge(onMessage$("user"), onMessage$("tool"));
const turnEnd$ = onMessage$("agent");

turnStart$
  .pipe(
    switchMap(() =>
      thinkingSubject$.pipe(
        takeUntil(
          writingSubject$.pipe(
            filter((t) => !!t),
            take(1)
          )
        ),
        tap((tokens) => process.stdout.write(`\x1b[37m${tokens}`)),
        finalize(() => {
          process.stdout.write("\n\n\x1b[38;5;255mAgent is typing...\n");
        })
      )
    )
  )
  .subscribe();

turnStart$
  .pipe(
    switchMap(() =>
      writingSubject$.pipe(
        takeUntil(turnEnd$),
        tap((tokens) => process.stdout.write(`\x1b[38;5;12m${tokens}`)),
        finalize(() => {
          process.stdout.write(`\n\n`);
          rl.setPrompt("\x1b[38;5;46m>>> \x1b[38;5;255m");
          rl.prompt();
        })
      )
    )
  )
  .subscribe();

const tools$ = onMessage$("tool");

tools$.subscribe((res) => process.stdout.write(`\x1b[36m${res?.content}\n\n`));
