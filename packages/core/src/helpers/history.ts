import { distinctUntilChanged, filter, map } from "rxjs";
import { Message } from "../types.js";
import { state$ } from "../store.js";

export function onMessage$(role: Message["role"]) {
  return state$.pipe(
    map((s) => s.history.at(-1)),
    distinctUntilChanged((a, b) => a?.id === b?.id),
    filter((m) => m?.role === role)
  );
}
