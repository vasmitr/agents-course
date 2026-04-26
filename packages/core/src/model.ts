import ollama, { ChatResponse } from "ollama";
import { ModelPartialUpdate } from "./types.js";
import { defer, from, map, mergeMap } from "rxjs";

const OLLAMA_MODEL = "gemma4:26b";

const transformResponsePart = (part: ChatResponse): ModelPartialUpdate => {
  const thinking = part?.message?.thinking || "";
  const content = part.message.content || "";

  return { thinking, content };
};

export const fetchOllama$ = (context: string) =>
  // Convert async generator to an observable
  defer(() =>
    from(
      ollama.chat({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: context }],
        stream: true
      })
    )
  ).pipe(
    // Stream each token
    mergeMap((res: AsyncIterable<ChatResponse>) => from(res)),
    // return { thinking, content };
    map(transformResponsePart)
  );
