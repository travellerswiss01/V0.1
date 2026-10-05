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
}

export interface CeoStrategy {
  metrics:CompanyMetrics;
  priority:"build"|"validate"|"learn"|"preserve_cash";
  rationale:string;
  performance:OpportunityPerformance[];
  scoreOpportunity:(opportunity:Opportunity)=>number;
}

function performanceFor(state:CompanyState):OpportunityPerformance[]{
  const byOpportunity=new Map<string,{attempts:number;successes:number;failures:number;cost:number;revenue:number}>();
  for(const execution of state.executions){
    const opportunityId=state.decisions.find(d=>d.id===execution.decisionId)?.opportunityId;
    if(!opportunityId) continue;
    const row=byOpportunity.get(opportunityId)??{attempts:0,successes:0,failures:0,cost:0,revenue:0};
    row.attempts++;
    if(execution.status==="completed") row.successes++;
    if(execution.status==="failed") row.failures++;
    row.cost+=execution.costChf;
    row.revenue+=Math.max(0,execution.revenueChf??0);
    byOpportunity.set(opportunityId,row);
  }
  return [...byOpportunity.entries()].map(([opportunityId,row])=>{
    const profitChf=row.revenue-row.cost;
    return {
      opportunityId,attempts:row.attempts,successes:row.successes,failures:row.failures,
      successRate:row.attempts?row.successes/row.attempts:0,
      averageCostChf:row.attempts?row.cost/row.attempts:0,
      revenueChf:row.revenue,profitChf,
      roi:row.cost===0?0:profitChf/row.cost
    };
  });
}

export function deriveCeoStrategy(state:CompanyState):CeoStrategy {
  const metrics=companyMetrics(state);
  const performance=performanceFor(state);
  const repeatedFailures=new Set(performance.filter(p=>p.failures>0&&p.successes===0).map(p=>p.opportunityId));
  const provenSuccesses=new Set(performance.filter(p=>p.successes>0&&p.successRate>=0.5).map(p=>p.opportunityId));

  let priority:CeoStrategy["priority"]="validate";
  if(metrics.cashChf<=0) priority="preserve_cash";
  else if(metrics.completedExecutions===0) priority="validate";
  else if(metrics.failureRate>=0.5) priority="learn";
  else if(metrics.revenuePerCompletedExecution<=0) priority="validate";
  else priority="build";

  const rationale=priority==="preserve_cash"
    ?"Cash is exhausted; do not approve new spend."
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
        if(history.successRate>0) score+=Math.min(20,history.successRate*20);
        score-=Math.min(12,history.attempts*3);
        if(history.averageCostChf>opportunity.estimatedCostChf){
          score-=Math.min(15,(history.averageCostChf-opportunity.estimatedCostChf)*2);
        }
        if(history.profitChf>0) score+=Math.min(30,history.profitChf/5);
        else if(history.revenueChf===0 && history.attempts>0) score-=10;
        if(history.roi>0) score+=Math.min(20,history.roi*5);
        else if(history.roi<0) score-=Math.min(20,Math.abs(history.roi)*5);
      }

      if(priority==="learn") score-=opportunity.estimatedCostChf*.5;
      if(priority==="preserve_cash") score-=opportunity.estimatedCostChf*10;
      return score;
    }
  };
}
