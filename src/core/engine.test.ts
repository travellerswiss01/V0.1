import assert from "node:assert/strict";
import { Memory } from "./memory.js";
import { classifyRisk, requiresApproval } from "./policy.js";
import { research } from "../agents/research.js";
import { runCeoCycle } from "../agents/ceo.js";

const memory = new Memory(100);
const opportunities = research();
assert.ok(opportunities.length >= 3, "Research must return opportunities");
assert.ok(opportunities[0].score >= opportunities[1].score, "Research must rank opportunities");

const decision = runCeoCycle(memory);
const state = memory.snapshot();
assert.equal(state.cycle, 1, "CEO cycle must increment cycle");
assert.equal(state.decisions.length, 1, "CEO cycle must create a decision");
assert.ok(decision.opportunityId, "Decision must identify its opportunity");
assert.ok(decision.alternatives.length >= 1, "Decision must retain alternatives");
assert.equal(decision.budgetChf, state.opportunities.find(o=>o.id===decision.opportunityId)?.estimatedCostChf);
assert.equal(decision.status, "approved", "Affordable prototype decision should be approved");
assert.equal(classifyRisk("delete production database"), "high");
assert.equal(requiresApproval("high"), true);
assert.equal(state.opportunities[0].id, opportunities[0].id, "Research ranking must remain deterministic");
console.log("V0.1 autonomous decision-cycle tests passed.");