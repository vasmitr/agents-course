import {
  catchError,
  concatMap,
  defer,
  distinctUntilChanged,
  filter,
  finalize,
  from,
  of,
  map,
  mergeMap,
  reduce,
  scan,
  shareReplay,
  Subject,
  tap
} from "rxjs";
import ollama, { ChatResponse } from "ollama";
import { Tool, toolRegistry } from "./tools.js";
import { stringify } from "node:querystring";

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

// 3. React to the user message
export const cleanupStreamTokens = () => {
  thinkingSubject$.next("");
  writingSubject$.next("");
};

export const streamResponseTokens = (res: ModelPartialUpdate) => {
  thinkingSubject$.next(res.thinking);
  writingSubject$.next(res.content);
};

// Streaming state
export const thinkingSubject$ = new Subject<string>();
export const writingSubject$ = new Subject<string>();

export const buildSystemPrompt = () => {
  const toolsList = Array.from(toolRegistry.values())
    .map(
      (tool) => `
### ${tool.name}
Description: ${tool.description}
Parameters:
${JSON.stringify(tool.parameters, null, 2)}
`
    )
    .join("\n");

  return `
You are a helpful assistant with access to the following tools.
When you need to use a tool, you MUST use the following XML-style format:

<tool>
{
  "name": "tool_name",
  "arguments": {
    "arg1": "value1",
    ...
  }
}
</tool>

Available Tools:
${toolsList}


*Rules*
- Make incremental changes, e. g. write file content, next turn read it and fix errors
- Do not attempt to self-correct the broken tool call
- Strictly return one tool call per message, you'll be called again with result when it's processed
- Always prefer external validation, for instance run tests, linter, type checks

`;
};

export const buildContext = (history: Message[]) => {
  // Build context from history + system message
  return [
    buildSystemPrompt(),
    ...history.map((m) => `${m.role.toUpperCase()}: ${m.content}`)
  ].join("\n\n");
};

state$
  .pipe(
    // We only want to react on user's message
    filter((state) =>
      ["user", "tool"].includes(state.history.at(-1)?.role || "")
    ),
    // Process history into context
    map((state) => buildContext(state.history)),
    // For each user message found, call LLM
    concatMap((context) => {
      return fetchOllama$(context).pipe(
        // Stream tokens for UI
        tap(streamResponseTokens),
        finalize(cleanupStreamTokens),
        // Build finalMessage from response tokens
        reduce((acc, res) => acc + res.content, ""),
        tap((finalMessage) =>
          postMessage({
            role: "agent",
            content: finalMessage
          })
        )
      );
    })
  )
  .subscribe();

export function onMessage$(role: Message["role"]) {
  return state$.pipe(
    map((s) => s.history.at(-1)),
    distinctUntilChanged((a, b) => a?.id === b?.id),
    filter((m) => m?.role === role)
  );
}

// Tools
interface ToolCall {
  name: string;
  arguments: unknown[];
}

const extractToolCallsFromMessage = (content: string) =>
  content.matchAll(/<tool>([\s\S]*?)<\/tool>/g);

const processToolCallMatches = (match?: RegExpMatchArray) => match?.[1]?.trim();

const parseCall = (json?: string) => JSON.parse(json || "{}") as ToolCall;

const getToolByCall = (call: ToolCall) => {
  const tool = toolRegistry.get(call.name);

  if (!tool) {
    throw new Error(`Tool "${call.name}" not found.`);
  }

  return { tool, args: call.arguments };
};

interface ValidateToolArgsProps {
  tool: Tool<any>;
  args: unknown[];
}

const validateToolArgs = (props: ValidateToolArgsProps) => {
  const { tool, args } = props;

  const validationResult = tool.validate(args);

  if (!validationResult.success) {
    throw new Error(
      `Validation failed for "${tool.name}": ${JSON.stringify(validationResult.issues)}`
    );
  }

  return { tool, data: validationResult.output };
};

interface ExecuteToolProps {
  tool: Tool<any>;
  data: unknown;
}
const executeTool$ = (props: ExecuteToolProps) => {
  const { tool, data } = props;

  return defer(() =>
    from(tool.execute(data)).pipe(
      map((res) => JSON.stringify(res || {})),
      map((res) => ({
        role: "tool" as const,
        content: res
      }))
    )
  );
};

state$
  .pipe(
    filter((state) => state.history.at(-1)?.role === "agent"),
    map((state) => state.history.at(-1)!.content),

    mergeMap((content) => from(extractToolCallsFromMessage(content))),
    map(processToolCallMatches),
    concatMap((jsonStr) =>
      of(jsonStr).pipe(
        map(parseCall),
        map(getToolByCall),
        map(validateToolArgs),
        concatMap(executeTool$),
        catchError((err) =>
          of({
            role: "tool" as const,
            content: JSON.stringify(err || {})
          })
        )
      )
    ),
    tap(postMessage)
  )
  .subscribe();
