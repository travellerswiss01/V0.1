export type RiskLevel = "low" | "medium" | "high";

export type FailureCode =
  | "transient"|"validation"|"budget"|"approval"|"auth"|"permission"|"policy"
  | "destructive"|"legal"|"payment"|"unknown";

export interface Opportunity {
  id:string; title:string; customer:string; priceChf:number; mvpDays:number;
  estimatedCostChf:number; competition:"low"|"medium"|"high"; automation:number;
  score:number; rationale:string;
}
export interface ProductSpecification {
  id:string; decisionId:string; opportunityId:string; createdAt:string;
  targetCustomer:string; problem:string; valueProposition:string;
  features:string[]; userFlow:string[]; acceptanceCriteria:string[];
  pricingChf:number; mvpScope:string[]; outOfScope:string[];
}
export interface Decision {
  id:string; cycle:number; action:string; reason:string; expectedOutcome:string;
  confidence:number; risk:RiskLevel; approved:boolean; createdAt:string;
  opportunityId:string; opportunityScore:number; alternatives:string[];
  budgetChf:number; status:"approved"|"pending_approval"|"rejected";
}
export interface CodeReviewArtifact {
  approved:boolean; score:number; findings:string[]; mode:"ai"|"deterministic"; summary:string;
}
export interface ExecutionResult {
  id:string; decisionId:string; status:"completed"|"blocked"|"failed";
  action:string; startedAt:string; completedAt:string; costChf:number;
  revenueChf?:number;
  output:string; error?:string; attempt?:number; maxAttempts?:number;
  failureCode?:FailureCode; retryable?:boolean;
  artifacts?:{workspace?:string;files?:string[];checks?:{build:boolean;test:boolean;prototype:boolean};
    mode?:"ai"|"deterministic";
    review?:CodeReviewArtifact;
    github?:{branch:string;commitSha:string;prNumber:number;prUrl:string}};
}
export interface LedgerEntry {
  id:string; timestamp:string;
  type:"decision_created"|"decision_approved"|"execution_failed"|"execution_retry_scheduled"|"execution_recovered"|"execution_recorded";
  decisionId:string; status:string; action:string; budgetChf:number; risk:RiskLevel; detail:string;
}
export interface MemoryNote {
  id:string; createdAt:string; category:"learning"|"observation"|"constraint";
  text:string; cycle:number; source:"human"|"system"|"execution";\n  executionId?:string; opportunityId?:string;
}
export interface CompanyState {
  schemaVersion:number; updatedAt:string;
  cashChf:number; revenueChf:number; costsChf:number; cycle:number;
  opportunities:Opportunity[]; decisions:Decision[]; executions:ExecutionResult[];
  pendingApprovals:string[]; ledger:LedgerEntry[]; notes:MemoryNote[]; specifications:ProductSpecification[];
}