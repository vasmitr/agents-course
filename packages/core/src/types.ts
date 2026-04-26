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

export interface ToolCall {
  name: string;
  arguments: unknown[];
}

export interface ModelPartialUpdate {
  thinking: string;
  content: string;
}
