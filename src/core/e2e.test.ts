import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Memory} from "./memory.js";
import {CeoToolService} from "../agents/ceo-tools.js";
import {runCeoCycle} from "../agents/ceo.js";

const dir=mkdtempSync(join(tmpdir(),"autonomous-company-e2e-"));
const statePath=join(dir,"company-state.json");

try {
  const memory=new Memory(500,statePath);

  const firstDecision=await runCeoCycle(memory);
  let state=memory.snapshot();
  const firstExecution=state.executions.find(item=>item.decisionId===firstDecision.id);

  if(firstExecution?.status==="failed") console.error("E2E execution error:",firstExecution.error);
  assert.ok(firstExecution,"CEO cycle must create an execution result");
  assert.equal(firstExecution?.status,"completed","E2E build must complete");
  assert.ok(firstExecution?.artifacts?.workspace,"Execution must expose the product workspace");
  assert.equal(firstExecution?.artifacts?.checks?.build,true,"Repository build must pass");
  assert.equal(firstExecution?.artifacts?.checks?.test,true,"Smoke test must pass");
  assert.equal(firstExecution?.artifacts?.checks?.prototype,true,"Prototype TypeScript validation must pass");

  const growth=new CeoToolService(memory);
  const prepared=growth.prepareGrowth(
    firstDecision.opportunityId,
    "E2E test customer",
    "Validated MVP offer"
  );
  assert.equal(prepared.status,"prepared","Growth plan must be approval-gated but preparable");

  const verifiedEvents=[
    {type:"lead" as const,externalEventId:"e2e-lead-1"},
    {type:"contact" as const,externalEventId:"e2e-contact-1"},
    {type:"reply" as const,externalEventId:"e2e-reply-1"},
    {type:"qualified" as const,externalEventId:"e2e-qualified-1"},
    {type:"offer" as const,externalEventId:"e2e-offer-1"},
    {type:"customer" as const,externalEventId:"e2e-customer-1"},
    {type:"revenue" as const,valueChf:120,externalEventId:"e2e-revenue-1"}
  ];

  for(const event of verifiedEvents){
    growth.recordGrowthEvent({
      opportunityId:firstDecision.opportunityId,
      channel:"b2b",
      ...event
    });
  }

  // Duplicate revenue delivery must be idempotent.
  growth.recordGrowthEvent({
    opportunityId:firstDecision.opportunityId,
    channel:"b2b",
    type:"revenue",
    valueChf:120,
    externalEventId:"e2e-revenue-1"
  });

  const performance=growth.growthPerformance(firstDecision.opportunityId);
  assert.equal(performance.leads,1);
  assert.equal(performance.contacts,1);
  assert.equal(performance.replies,1);
  assert.equal(performance.qualified,1);
  assert.equal(performance.offers,1);
  assert.equal(performance.customers,1);
  assert.equal(performance.revenueChf,120);

  state=memory.snapshot();
  assert.equal(state.revenueChf,120,"Verified growth revenue must return to company revenue");
  assert.equal(state.cashChf,500-firstExecution.costChf+120,"Verified growth revenue must increase cash exactly once");

  // The next CEO cycle must consume the verified growth result as learning.
  const secondDecision=await runCeoCycle(memory);
  const secondState=memory.snapshot();
  const learned=secondState.decisions.find(item=>item.id===secondDecision.id);
  assert.ok(learned);
  assert.match(
    learned?.reason??"",
    /revenue CHF 120\.00/i,
    "CEO decision rationale must include verified growth revenue"
  );

  console.log(JSON.stringify({
    status:"passed",
    firstCycle:firstDecision.cycle,
    secondCycle:secondDecision.cycle,
    opportunityId:firstDecision.opportunityId,
    growthFunnel:performance,
    companyRevenueChf:secondState.revenueChf,
    companyCashChf:secondState.cashChf,
    learningReturnedToCeo:true
  },null,2));
} finally {
  rmSync(dir,{recursive:true,force:true});
}
