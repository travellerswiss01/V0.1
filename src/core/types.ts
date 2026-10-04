export type RiskLevel = "low" | "medium" | "high";

export interface Opportunity {
  id:string; title:string; customer:string; priceChf:number; mvpDays:number;
  estimatedCostChf:number; competition:"low"|"medium"|"high"; automation:number;
  score:number; rationale:string;
}

export interface Decision {
  id:string; cycle:number; action:string; reason:string; expectedOutcome:string;
  confidence:number; risk:RiskLevel; approved:boolean; createdAt:string;
  opportunityId:string; opportunityScore:number; alternatives:string[];
  budgetChf:number; status:"approved"|"pending_approval"|"rejected";
}

export interface ExecutionResult {
  id:string; decisionId:string; status:"completed"|"blocked"|"failed";
  action:string; startedAt:string; completedAt:string; costChf:number;
  output:string; error?:string;
}

export interface CompanyState {
  cashChf:number; revenueChf:number; costsChf:number; cycle:number;
  opportunities:Opportunity[]; decisions:Decision[];
  executions:ExecutionResult[]; pendingApprovals:string[];
}