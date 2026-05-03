import { filter, tap } from "rxjs";
import { onMessage$ } from "@packages/core/helpers";
import { COLORS } from "../colors.js";

export function getToolMessageStream() {
  return onMessage$("tool").pipe(
    filter((res) => !!res),
    tap((res) => {
      const content = res.content?.slice(0, 100);
      process.stdout.write(`\r${COLORS.white}Tool Call\n`);
      process.stdout.write(`${COLORS.cyan}${content}\n...\n\n`);
      process.stdout.write(`${COLORS.white}Agent is thinking...\n`);
    })
  );
}
