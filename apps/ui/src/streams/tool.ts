import { filter, tap, Observable } from "rxjs";
import type { Message } from "@packages/core";
import { COLORS } from "../colors.js";

export function getToolMessageStream(toolMessage$: Observable<Message | undefined>) {
  return toolMessage$.pipe(
    filter((res): res is Message => !!res),
    tap((res) => {
      const content = res.content?.slice(0, 100);
      process.stdout.write(`\r${COLORS.white}Tool Call\n`);
      process.stdout.write(`${COLORS.cyan}${content}\n...\n\n`);
      process.stdout.write(`${COLORS.white}Agent is thinking...\n`);
    })
  );
}
