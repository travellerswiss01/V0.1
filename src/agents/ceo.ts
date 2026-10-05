import {randomUUID} from "node:crypto";
import {classifyRisk,requiresApproval} from "../core/policy.js";
import type {Decision} from "../core/types.js";
import {research} from "./research.js";
import {Memory} from "../core/memory.js";
import {executeCodeAgent} from "./code-agent.js";
import {researchMarket,rankMarketResearch} from "./market-intelligence.js";
import {deriveCeoStrategy} from "../core/ceo-strategy.js";


export async function runCeoCycle(memory:Memory):Promise<Decision> {
  memory.nextCycle();
  const state=memory.snapshot();
  const strategy=deriveCeoStrategy(state);
  if(strategy.priority==="preserve_cash") throw new Error("CEO strategy is preserving cash; no new spend should be approved.");
  const candidates=research();
  memory.setOpportunities(candidates);
  const marketReports=rankMarketResearch(candidates.map(researchMarket));
  const ranked=candidates
    .map(opportunity=>{
      const market=marketReports.find(r=>r.opportunityId===opportunity.id)!;
      return {opportunity,market,decisionScore:strategy.scoreOpportunity(opportunity)+market.marketSizeScore*.15+market.demandScore*.15+market.competitionScore*.15};
    })
    .filter(x=>x.market.recommendation!=="reject")
    .sort((a,b)=>b.decisionScore-a.decisionScore);

  if(!ranked.length) throw new Error("Market intelligence rejected all current opportunities.");
  const top=ranked[0].opportunity;
  const topMarket=ranked[0].market;
  const alternatives=ranked.slice(1,3).map(x=>x.opportunity.title);
  const budget=top.estimatedCostChf;
  const action=`Validate and prototype: ${top.title}`;
  const risk=classifyRisk(action);
  const affordable=budget<=state.cashChf;
  const approved=affordable&&!requiresApproval(risk);
  const status=!affordable?"rejected":approved?"approved":"pending_approval";
  const history=strategy.performance.find(p=>p.opportunityId===top.id);
  const historySummary=history
    ? ` History: ${history.attempts} attempt(s), ${Math.round(history.successRate*100)}% success, average cost CHF ${history.averageCostChf.toFixed(2)}.`
    : " History: no prior execution.";

  const decision:Decision={
    id:randomUUID(),cycle:state.cycle,action,
    reason:`${strategy.rationale} Selected from ${candidates.length} candidates after market intelligence. Decision score ${Math.round(ranked[0].decisionScore)}; demand ${topMarket.demandScore}, competition ${topMarket.competitionScore}, willingness-to-pay ${topMarket.willingnessToPayScore}.${historySummary} ${top.rationale}`,
    expectedOutcome:`Validate demand for CHF ${top.priceChf} offer within ${top.mvpDays} day(s), with a maximum test budget of CHF ${budget}.`,
    confidence:Math.min(.97,.55+Math.max(0,top.score)/300),
    risk,approved,createdAt:new Date().toISOString(),
    opportunityId:top.id,opportunityScore:top.score,alternatives,
    budgetChf:budget,status
  };
  memory.addDecision(decision);

  if(decision.status==="approved") await executeCodeAgent(memory,decision);
  return decision;
}