import assert from "node:assert/strict";
import {companyMetrics} from "./company-metrics.js";
import type {CompanyState} from "./types.js";

const state:CompanyState={
  schemaVersion:3,updatedAt:"2026-10-05T00:00:00.000Z",cashChf:95,revenueChf:39,costsChf:5,cycle:2,
  opportunities:[{id:"o1",title:"Test",customer:"SMB",priceChf:39,mvpDays:1,estimatedCostChf:5,competition:"low",automation:90,score:90,rationale:"fast"}],
  decisions:[{id:"d1",cycle:1,action:"build",reason:"test",expectedOutcome:"test",confidence:.9,risk:"low",approved:true,createdAt:"2026-10-05T00:00:00.000Z",opportunityId:"o1",opportunityScore:90,alternatives:[],budgetChf:5,status:"approved"}],
  executions:[{id:"e1",decisionId:"d1",status:"completed",action:"build",startedAt:"2026-10-05T00:00:00.000Z",completedAt:"2026-10-05T00:01:00.000Z",costChf:5,revenueChf:39,output:"ok",artifacts:{workspace:"test",review:{approved:true,score:90,findings:[],mode:"deterministic",summary:"ok"}}}],
  pendingApprovals:[],ledger:[],notes:[],specifications:[],growthEvents:[]
};
const m=companyMetrics(state);
assert.equal(m.revenueChf,39);
assert.equal(m.costsChf,5);
assert.equal(m.profitChf,34);
assert.equal(m.roi,6.8);
assert.equal(m.completedExecutions,1);
assert.equal(m.productsBuilt,1);
assert.equal(m.codeReviewsApproved,1);
assert.equal(m.conversionToExecution,1);
assert.equal(m.revenuePerCompletedExecution,39);
assert.equal(m.failureRate,0);
console.log("company-metrics.test.ts: PASS");
