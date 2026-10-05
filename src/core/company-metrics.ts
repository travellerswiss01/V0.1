import type {CompanyState} from "./types.js";

export interface CompanyMetrics {
  cashChf:number;
  revenueChf:number;
  costsChf:number;
  cycle:number;
  opportunities:number;
  decisions:number;
  approvedDecisions:number;
  executions:number;
  completedExecutions:number;
  failedExecutions:number;
  pendingApprovals:number;
  productsBuilt:number;
  codeReviewsApproved:number;
  conversionToExecution:number;
  revenuePerCompletedExecution:number;
  failureRate:number;
}

export function companyMetrics(state:CompanyState):CompanyMetrics {
  const executions=state.executions;
  const completedExecutions=executions.filter(e=>e.status==="completed").length;
  const failedExecutions=executions.filter(e=>e.status==="failed").length;
  const approvedDecisions=state.decisions.filter(d=>d.status==="approved"||d.approved).length;
  const codeReviewsApproved=executions.filter(e=>e.artifacts?.review?.approved===true).length;
  return {
    cashChf:state.cashChf,
    revenueChf:state.revenueChf,
    costsChf:state.costsChf,
    cycle:state.cycle,
    opportunities:state.opportunities.length,
    decisions:state.decisions.length,
    approvedDecisions,
    executions:executions.length,
    completedExecutions,
    failedExecutions,
    pendingApprovals:state.pendingApprovals.length,
    productsBuilt:executions.filter(e=>Boolean(e.artifacts?.workspace)).length,
    codeReviewsApproved,
    conversionToExecution:approvedDecisions===0?0:completedExecutions/approvedDecisions,
    revenuePerCompletedExecution:completedExecutions===0?0:state.revenueChf/completedExecutions,
    failureRate:executions.length===0?0:failedExecutions/executions.length
  };
}
