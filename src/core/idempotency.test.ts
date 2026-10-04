import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Memory} from "./memory.js";
import {classifyFailure,nextRetry} from "./failure.js";

const dir=mkdtempSync(join(tmpdir(),"v01-idempotency-"));
try{
  const memory=new Memory(100,join(dir,"company-state.json"));
  const decision:any={id:"decision-1",cycle:1,action:"test",reason:"test",expectedOutcome:"test",confidence:1,risk:"low",approved:true,createdAt:new Date().toISOString(),opportunityId:"op-1",opportunityScore:1,alternatives:[],budgetChf:10,status:"approved"};
  memory.addDecision(decision);
  const first:any={id:"execution-1",decisionId:decision.id,status:"completed",action:decision.action,startedAt:new Date().toISOString(),completedAt:new Date().toISOString(),costChf:10,output:"done"};
  const second:any={...first,id:"execution-2",costChf:10};
  memory.addExecution(first);
  const returned=memory.addExecution(second) as any;
  const state=memory.snapshot();
  assert.equal(state.executions.length,1);
  assert.equal(state.cashChf,90);
  assert.equal(state.costsChf,10);
  assert.equal(returned.id,"execution-1");
  const ledger=memory.getLedger();
  assert.equal(ledger.filter(e=>e.decisionId===decision.id).length,2);
  assert.equal(ledger[0]?.type,"execution_recorded");
  assert.equal(ledger[1]?.type,"decision_created");

  const secondDecision:any={...decision,id:"decision-2",budgetChf:95};
  memory.addDecision(secondDecision);
  assert.equal(memory.reservedBudgetChf(),95);
  assert.equal(memory.availableForExecutionChf(secondDecision.id),-5);
  const transient=classifyFailure(new Error("network timeout"));
  assert.equal(transient.code,"transient");
  assert.equal(transient.retryable,true);
  assert.equal(nextRetry(1,3,transient).retry,true);
  assert.equal(nextRetry(3,3,transient).retry,false);

  const validation=classifyFailure(new Error("TypeScript compile validation failed"));
  assert.equal(validation.code,"validation");
  assert.equal(validation.retryable,true);

  const unknown=classifyFailure(new Error("unexpected condition"));
  assert.equal(unknown.code,"unknown");
  assert.equal(unknown.retryable,false);

  memory.recordFailure(decision.id,decision.action,decision.risk,decision.budgetChf,{
    type:"execution_failed",status:"transient",detail:"attempt 1 failed"
  });
  memory.recordFailure(decision.id,decision.action,decision.risk,decision.budgetChf,{
    type:"execution_retry_scheduled",status:"retry_scheduled",detail:"attempt 2 scheduled"
  });
  memory.recordFailure(decision.id,decision.action,decision.risk,decision.budgetChf,{
    type:"execution_recovered",status:"recovered",detail:"attempt 2 succeeded"
  });
  const failureLedger=memory.getLedger();
  assert.equal(failureLedger[0]?.type,"execution_recovered");
  assert.equal(failureLedger[1]?.type,"execution_retry_scheduled");
  assert.equal(failureLedger[2]?.type,"execution_failed");

  console.log(JSON.stringify({status:"passed",executions:state.executions.length,cashChf:state.cashChf,costsChf:state.costsChf},null,2));
}finally{rmSync(dir,{recursive:true,force:true});}
