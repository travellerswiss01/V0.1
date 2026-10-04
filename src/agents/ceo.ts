import {randomUUID} from "node:crypto";
import {classifyRisk,requiresApproval} from "../core/policy.js";
import type {Decision} from "../core/types.js";
import {research} from "./research.js";
import {Memory} from "../core/memory.js";
export function runCeoCycle(memory:Memory):Decision{
  memory.nextCycle(); const opportunities=research(); memory.setOpportunities(opportunities); const top=opportunities[0];
  const action=`Validate and prototype: ${top.title}`; const risk=classifyRisk(action);
  const decision:Decision={id:randomUUID(),cycle:memory.snapshot().cycle,action,reason:top.rationale,
    expectedOutcome:`Test demand for CHF ${top.priceChf} offer within ${top.mvpDays} day(s).`,
    confidence:Math.min(.95,.55+top.score/300),risk,approved:!requiresApproval(risk),createdAt:new Date().toISOString()};
  memory.addDecision(decision); return decision;
}