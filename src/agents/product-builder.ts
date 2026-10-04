import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Decision, ExecutionResult } from "../core/types.js";
import { Memory } from "../core/memory.js";

export interface BuildArtifact {
  id:string;
  decisionId:string;
  path:string;
  createdAt:string;
  content:string;
}

export function executeBuild(memory:Memory, decision:Decision):ExecutionResult {
  const startedAt=new Date().toISOString();
  const state=memory.snapshot();

  if(decision.status!=="approved" || !decision.approved){
    const result:ExecutionResult={
      id:randomUUID(),decisionId:decision.id,status:"blocked",action:decision.action,
      startedAt,completedAt:new Date().toISOString(),costChf:0,
      output:"Build blocked: decision is not approved."
    };
    memory.addExecution(result);
    return result;
  }

  if(decision.budgetChf>state.cashChf){
    const result:ExecutionResult={
      id:randomUUID(),decisionId:decision.id,status:"failed",action:decision.action,
      startedAt,completedAt:new Date().toISOString(),costChf:0,
      output:"Build failed: insufficient cash.",
      error:`Required CHF ${decision.budgetChf}, available CHF ${state.cashChf}.`
    };
    memory.addExecution(result);
    return result;
  }

  const artifactId=randomUUID();
  const dir=join("data","builds",artifactId);
  mkdirSync(dir,{recursive:true});
  const content=`# Autonomous Product Build

Decision: ${decision.id}
Opportunity: ${decision.opportunityId}
Action: ${decision.action}

## Build status
Prototype scaffold generated successfully.

## Next
Connect this artifact to the real coding agent in the next controlled execution stage.
`;
  const artifactPath=join(dir,"README.md");
  writeFileSync(artifactPath,content);

  const result:ExecutionResult={
    id:artifactId,decisionId:decision.id,status:"completed",action:decision.action,
    startedAt,completedAt:new Date().toISOString(),costChf:decision.budgetChf,
    output:`Product-build agent generated a local prototype scaffold at ${artifactPath}.`
  };
  memory.addExecution(result);
  return result;
}