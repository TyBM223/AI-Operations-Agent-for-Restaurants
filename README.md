# MISE — AI Operations Agent for Restaurant Managers

A conversational AI agent that handles end-of-shift operations for restaurant managers. Built with React + Anthropic Claude (tool use / function calling).

## What it does

Type naturally about your shift. MISE figures out what you need and handles it:

- **Tip Outs** — "Tip out tonight: $6,200 sales, 4 servers, 3 bussers, 1 bartender"
- **Inventory** — "We used 3 cases salmon, 2 chicken, ran out of lemon"
- **Both at once** — MISE handles multiple tasks in a single message

## Architecture

This project demonstrates a real AI agent architecture:

```
User message
    ↓
Claude (LLM reasoning core)
    ↓ decides which tool to call
Tool dispatcher
    ├── calculate_tip_out()   — tip distribution logic
    └── analyze_inventory()   — order recommendations
    ↓ tool result returned to Claude
Claude (generates natural language response)
    ↓
Manager sees plain-English breakdown
```

This is the **ReAct pattern** (Reasoning + Acting) — the foundation of how production AI agents work. The LLM doesn't just generate text; it reasons about what action to take, calls a tool, observes the result, and responds based on real computed data.

### Key concepts demonstrated

- **Tool use / function calling** — Claude decides which function to invoke based on user intent
- **Agent loop** — Observe → Think → Act → Observe → Respond
- **Structured output** — Tools return typed data the LLM can reason over
- **System prompt engineering** — Persona and behavior defined via system context
- **Conversation history** — Full context window management across multi-turn chat

## Tech stack

- React + Vite (frontend)
- Anthropic Claude API with tool use (`claude-sonnet-4-20250514`)
- Vanilla CSS (no component library — intentional for portfolio clarity)

## Running locally

```bash
npm install
npm run dev
```

You'll need an Anthropic API key (get one at console.anthropic.com). Enter it in the app — it stays in your browser only, never sent anywhere else.

## Roadmap

- [ ] Persistent shift history (localStorage → backend)
- [ ] Per-restaurant custom tip-out rules
- [ ] ML-powered demand forecasting from historical usage data
- [ ] POS system integration (Square, Toast)
- [ ] Multi-location support

## Why this project

Most restaurants — especially independent ones — have no intelligent tooling for end-of-shift operations. Managers calculate tip outs by hand, guess at inventory, and lose money to both errors and waste every night. This agent replaces that manual work with a conversational interface that any manager can use without training.

The longer-term vision is a full AI operations layer for independent restaurants: scheduling, ordering, customer follow-up, and financial reporting — all accessible through natural language.
