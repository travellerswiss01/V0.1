import {randomUUID} from "node:crypto";
import {tool} from "@openai/agents";
import {z} from "zod";
import type {Decision, Opportunity} from "../core/types.js";
import {Memory} from "../core/memory.js";
import {research} from "./research.js";
import {executeCodeAgent} from "./code-agent.js";
import {classifyRisk,requiresApproval} from "../core/policy.js";
import {createProductSpecification} from "./product-spec.js";
import {GrowthAgent} from "../growth/growth-agent.js";

function decisionScore(opportunity:Opportunity,cashChf:number):number {
  const budgetFit=opportunity.estimatedCostChf<=cashChf?15:-40;
  const speed=opportunity.mvpDays<=1?15:opportunity.mvpDays<=3?10:0;
  const margin=opportunity.priceChf>opportunity.estimatedCostChf*2?10:0;
  return opportunity.score+budgetFit+speed+margin;
}

function rankOpportunities(items:Opportunity[],cashChf:number){
  return items.map(opportunity=>({opportunity,decisionScore:decisionScore(opportunity,cashChf)}))
    .sort((a,b)=>b.decisionScore-a.decisionScore);
}

export class CeoToolService {
  constructor(private readonly memory:Memory){}

  readCompanyState(){
    const state=this.memory.snapshot();
    return {
      schemaVersion:state.schemaVersion,
      cycle:state.cycle,
      cashChf:state.cashChf,
      revenueChf:state.revenueChf,
      costsChf:state.costsChf,
      pendingApprovals:state.pendingApprovals,
      opportunities:state.opportunities,
      decisions:state.decisions.slice(0,10),
      executions:state.executions.slice(0,10)
    };
  }

  readMemory(query?:string){
    return query?.trim()?this.memory.searchNotes(query):this.memory.recentNotes();
  }

  researchMarket(){
    const opportunities=research();
    this.memory.setOpportunities(opportunities);
    return opportunities;
  }

  analyzeOpportunity(opportunityId:string){
    const state=this.memory.snapshot();
    const opportunity=state.opportunities.find(item=>item.id===opportunityId) ?? research().find(item=>item.id===opportunityId);
    if(!opportunity) throw new Error("Opportunity not found.");
    return {
      opportunity,
      decisionScore:decisionScore(opportunity,state.cashChf),
      affordable:opportunity.estimatedCostChf<=state.cashChf,
      risk:classifyRisk(`Validate and prototype: ${opportunity.title}`),
      alternatives:rankOpportunities(state.opportunities.length?state.opportunities:research(),state.cashChf)
        .filter(item=>item.opportunity.id!==opportunity.id).slice(0,2).map(item=>item.opportunity.title)
    };
  }

  createDecision(opportunityId:string):Decision{
    const state=this.memory.snapshot();
    const candidates=state.opportunities.length?state.opportunities:research();
    const ranked=rankOpportunities(candidates,state.cashChf);
    const opportunity=candidates.find(item=>item.id===opportunityId);
    if(!opportunity) throw new Error("Opportunity not found.");
    const budget=opportunity.estimatedCostChf;
    const action=`Validate and prototype: ${opportunity.title}`;
    const risk=classifyRisk(action);
    const affordable=budget<=state.cashChf;
    const approved=affordable&&!requiresApproval(risk);
    const status=!affordable?"rejected":approved?"approved":"pending_approval";
    const decision:Decision={
      id:randomUUID(),cycle:state.cycle,action,
      reason:`Selected by CEO tool from ${candidates.length} candidates. Decision score ${decisionScore(opportunity,state.cashChf)}. ${opportunity.rationale}`,
      expectedOutcome:`Validate demand for CHF ${opportunity.priceChf} offer within ${opportunity.mvpDays} day(s), with a maximum test budget of CHF ${budget}.`,
      confidence:Math.min(.97,.55+Math.max(0,opportunity.score)/300),
      risk,approved,createdAt:new Date().toISOString(),
      opportunityId:opportunity.id,opportunityScore:opportunity.score,
      alternatives:ranked.filter(item=>item.opportunity.id!==opportunity.id).slice(0,2).map(item=>item.opportunity.title),
      budgetChf:budget,status
    };
    this.memory.addDecision(decision);
    return decision;
  }

  requestApproval(decisionId:string){
    const decision=this.memory.snapshot().decisions.find(item=>item.id===decisionId);
    if(!decision) throw new Error("Decision not found.");
    if(decision.status==="approved") return {requested:false,status:"approved",message:"Decision is already approved."};
    if(decision.status==="rejected") return {requested:false,status:"rejected",message:"Rejected decisions cannot be approved."};
    return {
      requested:true,
      status:"pending_approval",
      decisionId,
      message:"Human approval is required. The CEO tool cannot approve its own pending decision.",
      pendingApprovals:this.memory.snapshot().pendingApprovals
    };
  }

  createProductSpec(decisionId:string){
    const decision=this.memory.snapshot().decisions.find(item=>item.id===decisionId);
    if(!decision) throw new Error("Decision not found.");
    if(decision.status!=="approved"||!decision.approved) throw new Error("Product specification gate failed: only an approved decision can create a build specification.");
    return createProductSpecification(this.memory,decision);
  }

  async buildProduct(decisionId:string){
    const decision=this.memory.snapshot().decisions.find(item=>item.id===decisionId);
    if(!decision) throw new Error("Decision not found.");
    if(decision.status!=="approved"||!decision.approved) return {status:"blocked",reason:"Decision is not approved."};
    return await executeCodeAgent(this.memory,decision);
  }

  runTests(decisionId:string){
    const execution=this.memory.getExecutionByDecisionId(decisionId);
    if(!execution) return {status:"not_run",reason:"No execution exists for this decision."};
    return {
      status:execution.status,
      checks:execution.artifacts?.checks,
      workspace:execution.artifacts?.workspace
    };
  }

  publish(decisionId:string){
    const decision=this.memory.snapshot().decisions.find(item=>item.id===decisionId);
    if(!decision) throw new Error("Decision not found.");
    if(decision.status!=="approved"||!decision.approved) return {status:"blocked",reason:"Decision is not approved for publishing."};
    const execution=this.memory.getExecutionByDecisionId(decisionId);
    if(!execution||execution.status!=="completed") return {status:"blocked",reason:"A completed validated execution is required before publishing."};
    if(!execution.artifacts?.github) return {status:"blocked",reason:"No GitHub draft publication exists. Publishing remains disabled unless the guarded GitHub publisher is enabled during execution."};
    return {status:"published_as_draft",github:execution.artifacts.github,message:"GitHub publication is draft-only; this tool never merges to production."};
  }

  prepareGrowth(opportunityId:string,targetCustomer:string,offer:string){
    const plan={opportunityId,targetCustomer,offer,primaryChannel:"b2b" as const,dailyBudgetChf:0,requiresApproval:true,successMetrics:["leads","qualified","replies","customers","revenueChf"]};
    return new GrowthAgent().prepare(plan);
  }

  measure(){
    const state=this.memory.snapshot();
    return {
      cycle:state.cycle,cashChf:state.cashChf,revenueChf:state.revenueChf,costsChf:state.costsChf,
      pendingApprovals:state.pendingApprovals.length,
      decisions:state.decisions.length,executions:state.executions.length,
      completedExecutions:state.executions.filter(item=>item.status==="completed").length
    };
  }
}

export function createCeoTools(memory:Memory){
  const service=new CeoToolService(memory);
  return [
    tool({name:"read_company_state",description:"Read the current company state, cash, KPIs, opportunities, decisions and executions.",parameters:z.object({}),execute:async()=>service.readCompanyState()}),
    tool({name:"read_memory",description:"Read persistent company memory notes. Optionally search notes by a keyword.",parameters:z.object({query:z.string().optional()}),execute:async({query})=>service.readMemory(query)}),
    tool({name:"research_market",description:"Run the current deterministic market research source and persist the resulting opportunities.",parameters:z.object({}),execute:async()=>service.researchMarket()}),
    tool({name:"analyze_opportunity",description:"Analyze an opportunity against current cash, speed, margin and risk policy.",parameters:z.object({opportunityId:z.string()}),execute:async({opportunityId})=>service.analyzeOpportunity(opportunityId)}),
    tool({name:"create_decision",description:"Create a decision for an existing opportunity. This never bypasses policy or budget gates.",parameters:z.object({opportunityId:z.string()}),execute:async({opportunityId})=>service.createDecision(opportunityId)}),
    tool({name:"request_approval",description:"Request human approval for a pending decision. This tool cannot approve its own decision.",parameters:z.object({decisionId:z.string()}),execute:async({decisionId})=>service.requestApproval(decisionId)}),
    tool({name:"create_product_spec",description:"Create the structured product specification for an existing decision before building.",parameters:z.object({decisionId:z.string()}),execute:async({decisionId})=>service.createProductSpec(decisionId)}),
    tool({name:"build_product",description:"Build a product only for an explicitly approved decision. Budget and execution-lock controls remain enforced by the coding agent.",parameters:z.object({decisionId:z.string()}),execute:async({decisionId})=>service.buildProduct(decisionId)}),
    tool({name:"run_tests",description:"Read validation results for an existing product execution.",parameters:z.object({decisionId:z.string()}),execute:async({decisionId})=>service.runTests(decisionId)}),
    tool({name:"publish",description:"Verify guarded GitHub draft publication for a completed approved execution. This tool never merges or deploys production.",parameters:z.object({decisionId:z.string()}),execute:async({decisionId})=>service.publish(decisionId)}),
    tool({name:"prepare_growth",description:"Prepare an approval-gated growth plan and measurable acquisition funnel. No outreach or spend is executed automatically.",parameters:z.object({opportunityId:z.string(),targetCustomer:z.string(),offer:z.string()}),execute:async({opportunityId,targetCustomer,offer})=>service.prepareGrowth(opportunityId,targetCustomer,offer)}),
    tool({name:"measure",description:"Return current company KPI measurements from persistent state.",parameters:z.object({}),execute:async()=>service.measure()})
  ];
}
