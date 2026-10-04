import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Memory} from "./memory.js";

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
  console.log(JSON.stringify({status:"passed",executions:state.executions.length,cashChf:state.cashChf,costsChf:state.costsChf},null,2));
}finally{rmSync(dir,{recursive:true,force:true});}
