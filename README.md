# Reactive Agents

A lightweight, mental model for building AI agents using **Reactive Programming (RxJS)**.

> This code is a material for my course on building agents, please follow my [Substack](https://vasilymitronov.substack.com/) if you're interested

## Why Reactive?

Most agent implementations rely on naive polling or complex "if-else" chains that become unreadable as features grow. This project treats an agent as a **Stream of Events**, providing:

- **Declarativity:** Focus on _what_ the agent should do, not how to manage intervals.
- **Predictability:** Consistent state transitions via a Reducer pattern.
- **Composition:** Add logging, observability, or new tool-use capabilities by simply "tapping" into the stream.

## Core Concepts

- **Turn-based Processing:** Orchestrates the lifecycle between User input, Model thinking, and Agent response.
- **State Management:** Uses RxJS `Subject` and `scan` for a predictable, Redux-like history.
- **Stream Transformation:** Handles LLM token streaming (including "thinking" blocks) with standard operators like `switchMap` and `takeUntil`.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v22+)
- [pnpm](https://pnpm.io/)
- [Ollama](https://ollama.com/) (running locally). Alternatively obtain an API key to use cloud provider.

> Caution! Local models are heavy and require a lot of RAM, you may want to opt into lighter 4b or 8b model

### Setup

```bash
pnpm install
```

### Run

```bash
pnpm start
```

_Input: Type your message and hit Enter. Double Enter to submit._

## Project Structure

- `apps/ui`: Terminal interface handling user input/output streams.
- `packages/core`: The reactive engine, state management, and LLM integration.

---
