import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Memory} from "./memory.js";
import {classifyRisk,requiresApproval} from "./policy.js";
import {executeCodeAgent} from "../agents/code-agent.js";
import {createProductSpecification} from "../agents/product-spec.js";
import type {Decision} from "./types.js";

const testDir=mkdtempSync(join(tmpdir(),"v01-approval-"));
const previousCwd=process.cwd();

const memory=new Memory(100,join(testDir,"company-state.json"));
memory.setOpportunities([{
  id:"approval-test",title:"Approval gate prototype",customer:"Test customer",priceChf:5,mvpDays:1,
  estimatedCostChf:5,competition:"low",automation:90,score:80,rationale:"Deterministic approval-gate fixture."
}]);

const decision:Decision={
  id:randomUUID(),
  cycle:1,
  action:"deploy prototype to production",
  reason:"Approval-gate integration test",
  expectedOutcome:"Prove that high-risk actions stop before execution.",
  confidence:.9,
  risk:classifyRisk("deploy prototype to production"),
  approved:false,
  createdAt:new Date().toISOString(),
  opportunityId:"approval-test",
  opportunityScore:80,
  alternatives:[],
  budgetChf:5,
  status:"pending_approval"
};

assert.equal(decision.risk,"high");
assert.equal(requiresApproval(decision.risk),true);
memory.addDecision(decision);

let state=memory.snapshot();
assert.deepEqual(state.pendingApprovals,[decision.id]);
assert.equal(state.executions.length,0,"High-risk decision must not execute before approval");

const approved=memory.approveDecision(decision.id);
assert.equal(approved?.status,"approved");
assert.equal(approved?.approved,true);
assert.deepEqual(memory.snapshot().pendingApprovals,[]);

// Execution is downstream of the persisted Product Specification gate.
createProductSpecification(memory,approved!);
assert.ok(memory.getProductSpecification(approved!.id));

await executeCodeAgent(memory,approved!);
state=memory.snapshot();
const execution=state.executions.find(item=>item.decisionId===decision.id);

assert.ok(execution,"Approved decision must produce an execution result");
assert.equal(execution?.status,"completed");
assert.ok(execution?.artifacts?.workspace);
assert.equal(execution?.artifacts?.checks?.build,true);
assert.equal(execution?.artifacts?.checks?.test,true);
assert.equal(execution?.artifacts?.checks?.prototype,true);
assert.equal(state.costsChf,decision.budgetChf);
assert.equal(state.cashChf,100-decision.budgetChf);

console.log(JSON.stringify({
  status:"passed",
  risk:decision.risk,
  blockedBeforeApproval:true,
  approved:true,
  executed:true,
  costChf:execution?.costChf
},null,2));

rmSync(testDir,{recursive:true,force:true});
