import type {CompanyState,Opportunity} from "./types.js";
import {companyMetrics,type CompanyMetrics} from "./company-metrics.js";

export interface OpportunityPerformance {
  opportunityId:string;
  attempts:number;
  successes:number;
  failures:number;
  successRate:number;
  averageCostChf:number;
  revenueChf:number;
  profitChf:number;
  roi:number;
  leads:number;
  contacts:number;
  replies:number;
  qualified:number;
  offers:number;
  customers:number;
  funnelConversion:number;
}

export interface CeoStrategy {
  metrics:CompanyMetrics;
  priority:"build"|"validate"|"learn"|"grow"|"preserve_cash";
  rationale:string;
  performance:OpportunityPerformance[];
  scoreOpportunity:(opportunity:Opportunity)=>number;
}

function performanceFor(state:CompanyState):OpportunityPerformance[]{
  const byOpportunity=new Map<string,{
    attempts:number;successes:number;failures:number;cost:number;revenue:number;
    leads:number;contacts:number;replies:number;qualified:number;offers:number;customers:number;
  }>();

  const rowFor=(opportunityId:string)=>{
    const existing=byOpportunity.get(opportunityId);
    if(existing) return existing;
    const row={attempts:0,successes:0,failures:0,cost:0,revenue:0,leads:0,contacts:0,replies:0,qualified:0,offers:0,customers:0};
    byOpportunity.set(opportunityId,row);
    return row;
  };

  for(const execution of state.executions){
    const opportunityId=state.decisions.find(d=>d.id===execution.decisionId)?.opportunityId;
    if(!opportunityId) continue;
    const row=rowFor(opportunityId);
    row.attempts++;
    if(execution.status==="completed") row.successes++;
    if(execution.status==="failed") row.failures++;
    row.cost+=execution.costChf;
  }

  for(const event of state.growthEvents ?? []){
    const row=rowFor(event.opportunityId);
    if(event.type==="lead") row.leads++;
    if(event.type==="contact") row.contacts++;
    if(event.type==="reply") row.replies++;
    if(event.type==="qualified") row.qualified++;
    if(event.type==="offer") row.offers++;
    if(event.type==="customer") row.customers++;
    if(event.type==="revenue") row.revenue+=Math.max(0,event.valueChf??0);
  }

  return [...byOpportunity.entries()].map(([opportunityId,row])=>{
    const profitChf=row.revenue-row.cost;
    const funnelConversion=row.leads===0?0:row.customers/row.leads;
    return {
      opportunityId,attempts:row.attempts,successes:row.successes,failures:row.failures,
      successRate:row.attempts?row.successes/row.attempts:0,
      averageCostChf:row.attempts?row.cost/row.attempts:0,
      revenueChf:row.revenue,profitChf,
      roi:row.cost===0?0:profitChf/row.cost,
      leads:row.leads,contacts:row.contacts,replies:row.replies,
      qualified:row.qualified,offers:row.offers,customers:row.customers,funnelConversion
    };
  });
}

export function deriveCeoStrategy(state:CompanyState):CeoStrategy {
  const metrics=companyMetrics(state);
  const performance=performanceFor(state);
  const repeatedFailures=new Set(performance.filter(p=>p.failures>0&&p.successes===0).map(p=>p.opportunityId));
  const provenSuccesses=new Set(performance.filter(p=>p.successes>0&&p.successRate>=0.5).map(p=>p.opportunityId));
  const provenGrowth=new Set(performance.filter(p=>p.customers>0||p.revenueChf>0).map(p=>p.opportunityId));

  let priority:CeoStrategy["priority"]="validate";
  if(metrics.cashChf<=0) priority="preserve_cash";
  else if(performance.some(p=>p.customers>0||p.revenueChf>0)) priority="grow";
  else if(metrics.failureRate>=0.5) priority="learn";
  else if(metrics.completedExecutions===0) priority="validate";
  else if(metrics.revenuePerCompletedExecution<=0) priority="validate";
  else priority="build";

  const rationale=priority==="preserve_cash"
    ?"Cash is exhausted; do not approve new spend."
    :priority==="grow"
      ?"Verified customer or revenue events exist; prioritise acquisition and monetisation around opportunities with real market traction."
      :priority==="learn"
        ?"Execution failure rate is at least 50%; favour cheap, reversible learning before increasing scope."
        :priority==="build"
          ?"The execution loop has produced successful results; favour opportunities with stronger economics and proven execution patterns."
          :"No completed execution has established a winning pattern yet; prioritise fast, affordable validation.";

  return {
    metrics,priority,rationale,performance,
    scoreOpportunity:(opportunity)=>{
      let score=opportunity.score;
      const history=performance.find(p=>p.opportunityId===opportunity.id);
      if(opportunity.estimatedCostChf>metrics.cashChf) score-=100;
      if(opportunity.mvpDays<=1) score+=15;
      else if(opportunity.mvpDays<=3) score+=10;
      if(opportunity.priceChf>opportunity.estimatedCostChf*2) score+=10;

      if(!history){
        score+=12;
      }else{
        if(repeatedFailures.has(opportunity.id)) score-=25;
        if(provenSuccesses.has(opportunity.id)) score+=10;
        if(provenGrowth.has(opportunity.id)) score+=15;
        if(history.successRate>0) score+=Math.min(20,history.successRate*20);
        score-=Math.min(12,history.attempts*3);
        if(history.averageCostChf>opportunity.estimatedCostChf){
          score-=Math.min(15,(history.averageCostChf-opportunity.estimatedCostChf)*2);
        }
        if(history.profitChf>0) score+=Math.min(30,history.profitChf/5);
        else if(history.revenueChf===0 && history.attempts>0 && history.leads===0) score-=10;
        if(history.roi>0) score+=Math.min(20,history.roi*5);
        else if(history.roi<0) score-=Math.min(20,Math.abs(history.roi)*5);
        if(history.leads>0 && history.customers===0) score-=Math.min(15,history.leads*2);
        if(history.customers>0) score+=Math.min(20,history.customers*5);
      }

      if(priority==="grow"){
        if(history?.customers || history?.revenueChf) score+=20;
        else score-=5;
      }
      if(priority==="learn") score-=opportunity.estimatedCostChf*.5;
      if(priority==="preserve_cash") score-=opportunity.estimatedCostChf*10;
      return score;
    }
  };
}
