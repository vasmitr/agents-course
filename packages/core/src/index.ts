import Rx from "rxjs";
import ollama, { ChatResponse } from "ollama";

// 1. Manage history state
export interface BaseMessage {
  content: string;
  role: "user" | "agent" | "system" | "tool";
}

export interface Message extends BaseMessage {
  id: string;
  created: Date;
}

export interface State {
  history: Message[];
}

const initialState: State = {
  history: []
};

const messageAction$ = new Rx.Subject<Message>();

export const postMessage = (message: BaseMessage) =>
  messageAction$.next({
    ...message,
    id: Math.random().toString(36).slice(2, 9),
    created: new Date()
  });

export const state$ = messageAction$.pipe(
  // On each event, notify subscribers with new copy of history state
  Rx.scan(
    (state: State, message) => ({
      ...state,
      history: [...state.history, message]
    }),
    initialState
  ),
  Rx.shareReplay(1)
);

// 2.  Call llm and stream response
const OLLAMA_MODEL = "gemma4:26b";

export interface ModelPartialUpdate {
  thinking: string;
  content: string;
}

const transformResponsePart = (part: ChatResponse): ModelPartialUpdate => {
  const thinking = part?.message?.thinking || "";
  const content = part.message.content || "";

  return { thinking, content };
};

export const fetchOllama$ = (context: string) =>
  // Convert async generator to an observable
  Rx.defer(() =>
    Rx.from(
      ollama.chat({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: context }],
        stream: true
      })
    )
  ).pipe(
    // Stream each token
    Rx.mergeMap((res: AsyncIterable<ChatResponse>) => Rx.from(res)),
    // return { thinking, content };
    Rx.map(transformResponsePart)
  );

// 3. React to the user message
export const cleanupStreamTokens = () => {
  thinkingSubject$.next("");
  activeContentSubject$.next("");
};

export const streamResponseTokens = (res: ModelPartialUpdate) => {
  thinkingSubject$.next(res.thinking);
  activeContentSubject$.next(res.content);
};

// Streaming state
export const thinkingSubject$ = new Rx.Subject<string>();
export const activeContentSubject$ = new Rx.Subject<string>();

export const buildContext = (history: Message[]) => {
  return [...history.map((m) => `${m.role.toUpperCase()}: ${m.content}`)].join(
    "\n\n"
  );
};

state$
  .pipe(
    // We only want to react on user's message
    Rx.filter((state) => state.history.at(-1)?.role === "user"),
    // Process history into context
    Rx.map((state) => buildContext(state.history)),
    // For each user message found, call LLM
    Rx.concatMap((context) => {
      return fetchOllama$(context).pipe(
        // Stream tokens for UI
        Rx.tap(streamResponseTokens),
        Rx.finalize(cleanupStreamTokens),
        // Build finalMessage from response tokens
        Rx.reduce((acc, res) => acc + res.content, ""),
        Rx.tap((finalMessage) =>
          postMessage({
            role: "agent",
            content: finalMessage
          })
        )
      );
    })
  )
  .subscribe();
