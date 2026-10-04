import assert from "node:assert/strict";
import { Memory } from "./memory.js";
import { classifyRisk, requiresApproval } from "./policy.js";
import { research } from "../agents/research.js";
import { runCeoCycle } from "../agents/ceo.js";

const memory = new Memory(100);
const opportunities = research();

assert.ok(opportunities.length >= 3, "Research must return opportunities");
assert.ok(opportunities[0].score >= opportunities[1].score, "Opportunities must be sorted by score");

const decision = runCeoCycle(memory);
const state = memory.snapshot();

assert.equal(state.cycle, 1, "CEO cycle must increment cycle");
assert.equal(state.decisions.length, 1, "CEO cycle must create a decision");
assert.equal(decision.approved, true, "Prototype decision should be executable in V0.1");
assert.equal(classifyRisk("delete production database"), "high");
assert.equal(requiresApproval("high"), true);
assert.equal(state.opportunities[0].id, opportunities[0].id, "CEO must use research ranking");

console.log("V0.1 core tests passed.");
