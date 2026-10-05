import {Agent,run} from "@openai/agents";
import {Memory} from "../core/memory.js";
import {createCeoTools,CeoToolService} from "./ceo-tools.js";
import {runCeoCycle} from "./ceo.js";
import type {Decision} from "../core/types.js";
import {researchMarket,rankMarketResearch} from "./market-intelligence.js";
import {research} from "./research.js";
import {deriveCeoStrategy} from "../core/ceo-strategy.js";

export interface CeoLoopResult {
  mode:"ai"|"deterministic";
  decision:Decision;
  summary:string;
  critic:"passed"|"skipped";
}

export async function runCeoDecisionLoop(memory:Memory):Promise<CeoLoopResult>{
  if(!process.env.OPENAI_API_KEY){
    const decision=await runCeoCycle(memory);
    memory.addNote("learning",
      `Cycle ${decision.cycle}: deterministic CEO selected "${decision.action}" and completed the guarded build/test path.`,
      "execution");
    return {
      mode:"deterministic",
      decision,
      summary:"AI layer disabled; deterministic CEO loop completed with the same safety gates.",
      critic:"skipped"
    };
  }

  const service=new CeoToolService(memory);
  const candidates=service.researchMarket();
  const marketReports=rankMarketResearch(research().map(researchMarket));
  const criticAgent=new Agent({
    name:"CEO Strategy Critic",
    model:process.env.OPENAI_CEO_MODEL||"gpt-5.5",
    instructions:"You are a skeptical startup critic. Review the candidate opportunities and recommend the best one for a small capital-constrained company. Reject ideas only when there is a clear budget, speed, margin, competition or execution problem. Return a concise recommendation and risks. Do not execute tools.",
  });
  const criticResult=await run(criticAgent,JSON.stringify({cashChf:memory.snapshot().cashChf,candidates,marketIntelligence:marketReports}),{maxTurns:4});
  const criticSummary=criticResult.finalOutput??"No critic recommendation returned.";

  const agent=new Agent({
    name:"Autonomous Company CEO Decision Loop",
    model:process.env.OPENAI_CEO_MODEL||"gpt-5.5",
    instructions:[
      "You are the operating CEO of a small autonomous company.",
      "Run a complete decision loop using the provided tools.",
      "First inspect company state, persistent memory and current business metrics.",
      "Then research the market and analyze opportunities.",
      "Choose exactly one opportunity based on expected learning, affordability, speed, margin and the historical business metrics. Prefer learning when failure rate is high; preserve cash when cash is exhausted.",
      "Create a decision for the selected opportunity.",
      "If the decision is pending approval, request approval and stop; never approve it yourself.",
      "If the decision is approved, first create the structured product specification, then build the product and inspect its test result.",
      "Never publish production, spend outside the decision budget, make payments, send mass communications, sign contracts, or perform destructive actions.",
      "A separate strategy critic reviewed the current candidates before you act. Consider its recommendation, but make your own policy-compliant decision.",
      `Market intelligence: ${JSON.stringify(marketReports)}`,
      `Strategy critic: ${criticSummary}`,
      "Finish with a concise report containing cycle, selected opportunity, decision id, status, execution status and next action.",
      "Do not invent results: only report results returned by tools."
    ].join("\n"),
    tools:createCeoTools(memory)
  });

  const result=await run(agent,
    "Execute one complete autonomous company decision loop now. Use tools for every real state change.",
    {maxTurns:16});

  const state=memory.snapshot();
  const strategy=deriveCeoStrategy(state);
  const decision=state.decisions.at(-1);
  if(!decision) throw new Error("AI CEO loop finished without creating a decision.");

  memory.addNote("learning",
    `Cycle ${decision.cycle}: AI CEO selected "${decision.action}". Final status: ${decision.status}. Execution: ${state.executions.find(e=>e.decisionId===decision.id)?.status??"not executed"}.`,
    "execution");

  return {
    mode:"ai",
    decision,
    summary:`${result.finalOutput??"AI CEO completed the loop without a final summary."} Strategy: ${strategy.priority}. ${strategy.rationale}`,
    critic:"passed"
  };
}
