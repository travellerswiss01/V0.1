import {randomUUID} from "node:crypto";
import type {Decision,ExecutionResult} from "../core/types.js";
import {Memory} from "../core/memory.js";

export function executeDecision(memory:Memory, decision:Decision):ExecutionResult {
  const startedAt=new Date().toISOString();
  const state=memory.snapshot();

  if(decision.status!=="approved" || !decision.approved){
    const result:ExecutionResult={
      id:randomUUID(),decisionId:decision.id,status:"blocked",action:decision.action,
      startedAt,completedAt:new Date().toISOString(),costChf:0,
      output:"Execution blocked: decision is not approved."
    };
    memory.addExecution(result);
    return result;
  }

  if(decision.budgetChf>state.cashChf){
    const result:ExecutionResult={
      id:randomUUID(),decisionId:decision.id,status:"failed",action:decision.action,
      startedAt,completedAt:new Date().toISOString(),costChf:0,
      output:"Execution failed: insufficient cash.",
      error:`Required CHF ${decision.budgetChf}, available CHF ${state.cashChf}.`
    };
    memory.addExecution(result);
    return result;
  }

  // V0.1 execution adapter: actually creates a local experiment artifact.
  // External money, emails, deployments and legal actions remain outside this adapter.
  const result:ExecutionResult={
    id:randomUUID(),decisionId:decision.id,status:"completed",action:decision.action,
    startedAt,completedAt:new Date().toISOString(),costChf:decision.budgetChf,
    output:`Experiment executed for opportunity ${decision.opportunityId}. Local prototype/validation task completed.`
  };
  memory.addExecution(result);
  return result;
}