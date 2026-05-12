// ============================================================
// AGENT CORE — The ReAct Loop
//
// This is the brain of the agent. It implements the pattern:
//   Observe (read user message)
//   → Think (LLM reasons about what to do)
//   → Act (call a tool if needed)
//   → Observe (read tool result)
//   → Respond (LLM generates final answer)
//
// This is exactly how production AI agents work at companies
// like the one you're interviewing for tomorrow.
// ============================================================

import { TOOL_DEFINITIONS, calculateTipOut, analyzeInventory } from './agentTools';

const SYSTEM_PROMPT = `You are Mise, an AI operations agent built specifically for restaurant managers.
You help with two core tasks at end-of-shift:
1. Tip out calculations — distributing tips fairly among staff
2. Inventory tracking and order recommendations

You speak like a knowledgeable colleague, not a robot. Be direct, warm, and practical.
When you present numbers, format them clearly. When something needs urgent attention, say so plainly.

If the manager gives you enough info to use a tool, use it immediately — don't ask clarifying
questions unless truly necessary. Make reasonable assumptions (e.g. if bartenders aren't mentioned,
assume 0) and state those assumptions in your response.

After using a tool, explain the results conversationally. Don't just dump numbers — help the
manager actually understand what it means for their night and what to do next.

You can handle both tip outs AND inventory in the same conversation. If someone mentions both,
address both.`;

// ============================================================
// Tool dispatcher — maps tool names to actual functions
// This is the "hands" of the agent — when the LLM says
// "call calculate_tip_out with these params," this runs it.
// ============================================================
function dispatchTool(toolName, toolInput) {
  switch (toolName) {
    case 'calculate_tip_out':
      return calculateTipOut(toolInput);
    case 'analyze_inventory':
      return analyzeInventory(toolInput);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ============================================================
// Main agent function — the full ReAct loop
//
// Takes conversation history, sends to Claude with tools,
// handles tool calls if the model wants to use them,
// returns the final response + any tool results for the UI.
// ============================================================
export async function runAgent(conversationHistory) {
  const toolsUsed = [];

  // --- Step 1: Send conversation to Claude with tool definitions ---
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages: conversationHistory,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'API error');
  }

  // --- Step 2: Check if Claude wants to use a tool ---
  // stop_reason === 'tool_use' means the model decided it needs
  // to call one of our functions before it can answer.
  if (data.stop_reason === 'tool_use') {
    const toolUseBlocks = data.content.filter(block => block.type === 'tool_use');
    const toolResults = [];

    // --- Step 3: Execute each tool the model requested ---
    for (const toolCall of toolUseBlocks) {
      const result = dispatchTool(toolCall.name, toolCall.input);
      toolsUsed.push({ name: toolCall.name, input: toolCall.input, result });

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    // --- Step 4: Send tool results back to Claude ---
    // Now the model sees what the tools returned and generates
    // a final human-readable response based on those results.
    const followUp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages: [
          ...conversationHistory,
          { role: 'assistant', content: data.content },
          { role: 'user', content: toolResults },
        ],
      }),
    });

    const followUpData = await followUp.json();
    const finalText = followUpData.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    return { text: finalText, toolsUsed };
  }

  // No tool needed — model answered directly
  const text = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  return { text, toolsUsed };
}
