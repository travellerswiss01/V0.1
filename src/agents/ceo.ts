import {randomUUID} from "node:crypto";
import {classifyRisk,requiresApproval} from "../core/policy.js";
import type {Decision,Opportunity} from "../core/types.js";
import {research} from "./research.js";
import {Memory} from "../core/memory.js";

function evaluate(opportunity:Opportunity, cashChf:number):number {
  const budgetFit = opportunity.estimatedCostChf <= cashChf ? 15 : -40;
  const speed = opportunity.mvpDays <= 1 ? 15 : opportunity.mvpDays <= 3 ? 10 : 0;
  const margin = opportunity.priceChf > opportunity.estimatedCostChf * 2 ? 10 : 0;
  return opportunity.score + budgetFit + speed + margin;
}

export function runCeoCycle(memory:Memory):Decision {
  memory.nextCycle();
  const state = memory.snapshot();
  const candidates = research();
  const ranked = candidates
    .map(opportunity => ({opportunity, decisionScore:evaluate(opportunity,state.cashChf)}))
    .sort((a,b)=>b.decisionScore-a.decisionScore);

  const top = ranked[0].opportunity;
  const alternatives = ranked.slice(1,3).map(x=>x.opportunity.title);
  const budget = top.estimatedCostChf;
  const action = `Validate and prototype: ${top.title}`;
  const risk = classifyRisk(action);
  const affordable = budget <= state.cashChf;
  const approved = affordable && !requiresApproval(risk);
  const status = !affordable ? "rejected" : approved ? "approved" : "pending_approval";

  const decision:Decision={
    id:randomUUID(), cycle:state.cycle, action,
    reason:`Selected from ${candidates.length} candidates. Decision score ${evaluate(top,state.cashChf)}. ${top.rationale}`,
    expectedOutcome:`Validate demand for CHF ${top.priceChf} offer within ${top.mvpDays} day(s), with a maximum test budget of CHF ${budget}.`,
    confidence:Math.min(.97,.55+Math.max(0,top.score)/300),
    risk, approved, createdAt:new Date().toISOString(),
    opportunityId:top.id, opportunityScore:top.score, alternatives,
    budgetChf:budget, status
  };
  memory.addDecision(decision);
  return decision;
}