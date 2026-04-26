import * as fs from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import * as v from "valibot";
import { toJsonSchema } from "@valibot/to-json-schema";

const execAsync = promisify(exec);

export interface Tool<T extends v.BaseSchema<any, any, any>> {
  name: string;
  description: string;
  parameters: Record<string, any>;
  schema: T;
  validate: (input: unknown) => v.SafeParseResult<T>;
  execute: (args: v.InferOutput<T>) => Promise<any>;
}

export function createTool<T extends v.BaseSchema<any, any, any>>(config: {
  name: string;
  description: string;
  schema: T;
  execute: (args: v.InferOutput<T>) => Promise<any>;
}): Tool<T> {
  const jsonSchema = toJsonSchema(config.schema, {
    typeMode: "output",
    errorMode: "ignore"
  });

  return {
    name: config.name,
    description: config.description,
    schema: config.schema,
    parameters: jsonSchema,
    validate: (input) => v.safeParse(config.schema, input),
    execute: config.execute
  };
}

const readFileTool = createTool({
  name: "read_file",
  description: "Read the content of a file from the filesystem",
  schema: v.object({
    path: v.pipe(v.string(), v.description("The path to the file to read"))
  }),
  execute: async ({ path }) => fs.readFile(path, "utf-8")
});

const writeFileTool = createTool({
  name: "write_file",
  description: "Write content to a file. Overwrites if exists.",
  schema: v.object({
    path: v.pipe(v.string(), v.description("The path to the file")),
    content: v.pipe(v.string(), v.description("The content to write"))
  }),
  execute: async ({ path, content }) => {
    await fs.writeFile(path, content, "utf-8");
    return `Successfully wrote to ${path}`;
  }
});

const bashTool = createTool({
  name: "bash",
  description: "Execute a bash command in the project root",
  schema: v.object({
    command: v.pipe(v.string(), v.description("The bash command to execute"))
  }),
  execute: async ({ command }) => {
    try {
      const { stdout, stderr } = await execAsync(command);
      return stdout || stderr || "Command executed successfully (no output)";
    } catch (e: any) {
      return `Error: ${e.message}${e.stderr ? `\nStderr: ${e.stderr}` : ""}`;
    }
  }
});

const searchAndEditTool = createTool({
  name: "search_and_edit",
  description: `Search and replace text in a file using a diff-like format.
Format for 'diff':
<<<<
text to find
====
text to replace with
>>>>`,
  schema: v.object({
    path: v.pipe(v.string(), v.description("The path to the file")),
    diff: v.pipe(
      v.string(),
      v.description("The diff block using <<<<, ====, >>>> markers")
    )
  }),
  execute: async ({ path, diff }) => {
    const fileContent = await fs.readFile(path, "utf-8");
    const match = diff.match(/<<<<\n([\s\S]*?)\n====\n([\s\S]*?)\n>>>>/);

    if (!match) {
      throw new Error(
        "Invalid diff format. Use <<<<, ====, >>>> markers on new lines."
      );
    }

    const [_, find, replace] = match;

    if (!fileContent.includes(find)) {
      throw new Error(
        `Text to find not found in ${path}. Ensure whitespace and indentation match exactly.`
      );
    }

    const newContent = fileContent.replace(find, replace);
    await fs.writeFile(path, newContent, "utf-8");
    return `Successfully updated ${path}`;
  }
});

export const toolRegistry = new Map<string, Tool<any>>();

[readFileTool, writeFileTool, bashTool, searchAndEditTool].forEach((tool) =>
  toolRegistry.set(tool.name, tool)
);
