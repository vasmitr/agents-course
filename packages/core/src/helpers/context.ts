import { toolRegistry } from "../tools.js";
import { Message } from "../types.js";

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
