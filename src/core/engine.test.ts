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
const selected = opportunities.find(o=>o.id===decision.opportunityId);

assert.equal(state.cycle, 1, "CEO cycle must increment cycle");
assert.equal(state.decisions.length, 1, "CEO cycle must create a decision");
assert.ok(selected, "Decision must select a researched opportunity");
assert.ok(decision.alternatives.length >= 1, "Decision must retain alternatives");
assert.equal(decision.budgetChf, selected?.estimatedCostChf);
assert.equal(decision.status, "approved", "Affordable prototype decision should be approved");
assert.equal(state.executions.length, 1, "Approved decision must execute");
assert.equal(state.executions[0].status, "completed", "Execution must complete");
assert.equal(state.executions[0].decisionId, decision.id);
assert.equal(state.costsChf, selected?.estimatedCostChf);
assert.equal(state.cashChf, 100-(selected?.estimatedCostChf??0));
assert.equal(classifyRisk("delete production database"), "high");
assert.equal(requiresApproval("high"), true);

console.log("V0.1 autonomous decision -> execution tests passed.");