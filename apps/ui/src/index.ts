import readline from "node:readline/promises";
import { fromEvent, merge, Observable, Subject, BehaviorSubject, takeUntil } from "rxjs";
import { core$, thinkingSubject$, writingSubject$ } from "@packages/core";
import { onMessage$ } from "@packages/core/helpers";
import { UIState, ChatMode } from "./types.js";
import { COLORS } from "./colors.js";
import { getInputStreamStream } from "./streams/input.js";
import { getAgentStream } from "./streams/agent.js";
import { getToolMessageStream } from "./streams/tool.js";

class TerminalUI {
  private rl: readline.Interface;
  private state$ = new BehaviorSubject<UIState>(this.getChatState());
  private destroy$ = new Subject<void>();
  private input$: Observable<string>;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.input$ = fromEvent<string>(this.rl, "line");
  }

  private getChatState(): ChatMode {
    return {
      mode: "CHAT",
      prompt: `${COLORS.green}>>> ${COLORS.white}`
    };
  }

  public start() {
    const turnStart$ = merge(onMessage$("user"), onMessage$("tool"));
    const turnEnd$ = onMessage$("agent");

    merge(
      core$,
      getInputStreamStream(this.input$, this.state$, this.rl),
      getAgentStream(
        thinkingSubject$,
        writingSubject$,
        turnStart$,
        turnEnd$,
        () => this.state$.next(this.getChatState())
      ),
      getToolMessageStream(onMessage$("tool"))
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  public destroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.rl.close();
  }
}

const terminal = new TerminalUI();
terminal.start();
