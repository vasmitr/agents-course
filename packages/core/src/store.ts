import { scan, shareReplay, Subject } from "rxjs";
import { State, Message, BaseMessage, ModelPartialUpdate } from "./types.js";

export const initialState: State = {
  history: []
};

const messageAction$ = new Subject<Message>();

export const postMessage = (message: BaseMessage) =>
  messageAction$.next({
    ...message,
    id: Math.random().toString(36).slice(2, 9),
    created: new Date()
  });

export const state$ = messageAction$.pipe(
  // On each event, notify subscribers with new copy of history state
  scan(
    (state: State, message) => ({
      ...state,
      history: [...state.history, message]
    }),
    initialState
  ),
  shareReplay(1)
);

// Streaming state
export const thinkingSubject$ = new Subject<string>();
export const writingSubject$ = new Subject<string>();

export const cleanupStreamTokens = () => {
  thinkingSubject$.next("");
  writingSubject$.next("");
};

export const streamResponseTokens = (res: ModelPartialUpdate) => {
  thinkingSubject$.next(res.thinking);
  writingSubject$.next(res.content);
};
