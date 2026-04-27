import { defer, from, map } from "rxjs";
import { Tool, toolRegistry } from "../tools.js";
import { ToolCall } from "../types.js";

export const extractToolCallsFromMessage = (content: string) =>
  content.matchAll(/<tool>([\s\S]*?)<\/tool>/g);

export const processToolCallMatches = (match?: RegExpMatchArray) =>
  match?.[1]?.trim();

export const parseCall = (json?: string) =>
  JSON.parse(json || "{}") as ToolCall;

export const getToolByCall = (call: ToolCall) => {
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

export const validateToolArgs = (props: ValidateToolArgsProps) => {
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

export const executeTool$ = (props: ExecuteToolProps) => {
  const { tool, data } = props;

  return defer(() =>
    from(tool.execute(data)).pipe(
      map(
        (res) =>
          `${tool.name}: ${JSON.stringify(data)}\n${JSON.stringify(res || {})}`
      ),
      map((res) => ({
        role: "tool" as const,
        content: res
      }))
    )
  );
};
