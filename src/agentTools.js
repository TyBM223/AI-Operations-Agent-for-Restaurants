// ============================================================
// AGENT TOOLS
// These are the functions the AI agent can "call" to take action.
// In agent architecture, these are what give the LLM hands —
// the ability to DO things, not just generate text.
// ============================================================

/**
 * TOOL 1: Tip Out Calculator
 *
 * Real restaurant tip out logic. Takes total server sales,
 * number of staff by role, and optional custom percentages.
 * Returns a full breakdown the agent can explain to the manager.
 */
export function calculateTipOut({ totalSales, servers, bussers, bartenders = 0, runners = 0, customRates = {} }) {
  // Default tip-out rates (industry standard percentages of total sales)
  const rates = {
    busser: customRates.busser ?? 0.015,   // 1.5% of sales
    bartender: customRates.bartender ?? 0.01, // 1% of sales
    runner: customRates.runner ?? 0.01,    // 1% of sales
  };

  const totalSalesNum = parseFloat(totalSales);

  // Calculate total pool for each role
  const busserPool = totalSalesNum * rates.busser * bussers;
  const bartenderPool = totalSalesNum * rates.bartender * bartenders;
  const runnerPool = totalSalesNum * rates.runner * runners;
  const totalTippedOut = busserPool + bartenderPool + runnerPool;

  // Each server pays an equal share of the total tip-out
  const perServerContribution = servers > 0 ? totalTippedOut / servers : 0;

  // Per-person payouts
  const perBusser = bussers > 0 ? busserPool / bussers : 0;
  const perBartender = bartenders > 0 ? bartenderPool / bartenders : 0;
  const perRunner = runners > 0 ? runnerPool / runners : 0;

  return {
    summary: {
      totalSales: totalSalesNum,
      totalTippedOut: parseFloat(totalTippedOut.toFixed(2)),
      perServerContribution: parseFloat(perServerContribution.toFixed(2)),
      servers,
      bussers,
      bartenders,
      runners,
    },
    breakdown: {
      busserPool: parseFloat(busserPool.toFixed(2)),
      bartenderPool: parseFloat(bartenderPool.toFixed(2)),
      runnerPool: parseFloat(runnerPool.toFixed(2)),
      perBusser: parseFloat(perBusser.toFixed(2)),
      perBartender: parseFloat(perBartender.toFixed(2)),
      perRunner: parseFloat(perRunner.toFixed(2)),
    },
    rates,
  };
}

/**
 * TOOL 2: Inventory Advisor
 *
 * Takes what was used/depleted tonight and current stock levels,
 * returns an order recommendation based on par levels and usage patterns.
 *
 * In a real production system, this would pull from a database
 * and use ML forecasting on historical usage. For the demo, it
 * uses smart heuristics — still very useful, fully demonstrable.
 */
export function analyzeInventory({ usedItems, currentStock = {}, upcomingEvents = [] }) {
  // Default par levels — how much a typical restaurant wants on hand
  const defaultPar = {
    salmon: 8,
    chicken: 10,
    beef: 8,
    pork: 6,
    shrimp: 5,
    pasta: 12,
    rice: 10,
    lemon: 6,
    butter: 8,
    cream: 6,
    wine: 12,
    beer: 24,
    vodka: 4,
    default: 6,
  };

  const recommendations = [];
  const alerts = [];

  for (const [item, usedQty] of Object.entries(usedItems)) {
    const itemKey = item.toLowerCase();
    const par = defaultPar[itemKey] ?? defaultPar.default;
    const current = currentStock[itemKey] ?? 0;
    const afterService = Math.max(0, current - usedQty);

    // Event multiplier — if big events coming, order more
    const eventMultiplier = upcomingEvents.length > 0 ? 1.3 : 1.0;
    const targetStock = Math.ceil(par * eventMultiplier);
    const toOrder = Math.max(0, targetStock - afterService);

    const urgency = afterService === 0 ? 'critical' :
                    afterService < par * 0.25 ? 'high' :
                    afterService < par * 0.5 ? 'medium' : 'low';

    if (urgency === 'critical') {
      alerts.push(`⚠️ ${item.toUpperCase()} — RAN OUT tonight. Order immediately.`);
    }

    recommendations.push({
      item,
      usedTonight: usedQty,
      remainingStock: afterService,
      parLevel: par,
      orderQty: toOrder,
      urgency,
      note: toOrder > 0
        ? `Order ${toOrder} ${toOrder === 1 ? 'unit' : 'units'} to reach par`
        : 'Stocked — no order needed',
    });
  }

  // Sort by urgency
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return {
    recommendations,
    alerts,
    upcomingEvents,
    totalItemsToOrder: recommendations.filter(r => r.orderQty > 0).length,
  };
}

// ============================================================
// TOOL DEFINITIONS — Claude API format
//
// This is what gets sent to the Anthropic API to tell the LLM
// what tools it has available and what parameters each takes.
// The model reads these descriptions and decides which tool to
// call based on what the user is asking. This is "tool use" /
// "function calling" — core to how all production agents work.
// ============================================================
export const TOOL_DEFINITIONS = [
  {
    name: "calculate_tip_out",
    description: `Calculate tip out distributions for end-of-night restaurant closing.
      Use this when the manager mentions tip outs, tips, tip distribution, server tips,
      busser pay, closing out the night financially, or any variation of tip calculations.
      Requires total sales amount and number of staff by role.`,
    input_schema: {
      type: "object",
      properties: {
        totalSales: {
          type: "number",
          description: "Total restaurant sales for the shift in dollars"
        },
        servers: {
          type: "integer",
          description: "Number of servers working the shift"
        },
        bussers: {
          type: "integer",
          description: "Number of bussers / server assistants working the shift"
        },
        bartenders: {
          type: "integer",
          description: "Number of bartenders working the shift (default 0 if not mentioned)"
        },
        runners: {
          type: "integer",
          description: "Number of food runners working the shift (default 0 if not mentioned)"
        },
        customRates: {
          type: "object",
          description: "Optional custom tip-out percentages if the manager specifies different rates",
          properties: {
            busser: { type: "number", description: "Busser rate as decimal e.g. 0.015" },
            bartender: { type: "number", description: "Bartender rate as decimal" },
            runner: { type: "number", description: "Runner rate as decimal" }
          }
        }
      },
      required: ["totalSales", "servers", "bussers"]
    }
  },
  {
    name: "analyze_inventory",
    description: `Analyze tonight's inventory usage and generate order recommendations.
      Use this when the manager mentions what they used, what they ran out of, what they
      have left, what to order, inventory, stock levels, or anything about food/drink supplies.
      Returns prioritized order list with urgency levels.`,
    input_schema: {
      type: "object",
      properties: {
        usedItems: {
          type: "object",
          description: "Items used tonight as key-value pairs, e.g. { salmon: 3, chicken: 2 }. Extract item names and quantities from the manager's message.",
          additionalProperties: { type: "number" }
        },
        currentStock: {
          type: "object",
          description: "Current remaining stock levels if mentioned, e.g. { salmon: 1, chicken: 4 }",
          additionalProperties: { type: "number" }
        },
        upcomingEvents: {
          type: "array",
          description: "Any upcoming events or busy periods mentioned that would affect order quantities",
          items: { type: "string" }
        }
      },
      required: ["usedItems"]
    }
  }
];
