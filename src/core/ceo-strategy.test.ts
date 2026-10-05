import {strict as assert} from "node:assert";
import {deriveCeoStrategy} from "./ceo-strategy.js";
import type {CompanyState} from "./types.js";

const base:CompanyState={
  schemaVersion:2,updatedAt:new Date().toISOString(),cashChf:100,revenueChf:0,costsChf:0,cycle:2,
  opportunities:[{id:"cheap",title:"Cheap",customer:"x",priceChf:50,mvpDays:1,estimatedCostChf:10,competition:"low",automation:80,score:70,rationale:"fast"}],
  decisions:[],executions:[],pendingApprovals:[],ledger:[],notes:[]
};
const strategy=deriveCeoStrategy(base);
assert.equal(strategy.priority,"validate");
assert.ok(strategy.scoreOpportunity(base.opportunities[0])>70);

const failed={...base,executions:[{id:"e1",decisionId:"d1",status:"failed",action:"x",startedAt:"",completedAt:"",costChf:5,output:""}],decisions:[{id:"d1",cycle:1,action:"x",reason:"",expectedOutcome:"",confidence:.8,risk:"low",approved:true,createdAt:"",opportunityId:"cheap",opportunityScore:70,alternatives:[],budgetChf:10,status:"approved"}]};
const riskStrategy=deriveCeoStrategy(failed);
assert.equal(riskStrategy.priority,"learn");
assert.ok(riskStrategy.scoreOpportunity(base.opportunities[0])<strategy.scoreOpportunity(base.opportunities[0]));

console.log(JSON.stringify({status:"passed",initialPriority:strategy.priority,failurePriority:riskStrategy.priority}));
