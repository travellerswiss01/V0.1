import assert from "node:assert/strict";
import {BudgetPolicy} from "./budget.js";
import type {Decision,ExecutionResult} from "./types.js";

const policy=new BudgetPolicy();
const decision=(id:string,budgetChf:number,status:Decision["status"]="approved"):Decision=>({
  id,cycle:1,action:"prototype",reason:"test",expectedOutcome:"test",confidence:1,risk:"low",approved:status==="approved",
  createdAt:new Date().toISOString(),opportunityId:"op",opportunityScore:1,alternatives:[],budgetChf,status
});
const execution=(decisionId:string,costChf:number,status:ExecutionResult["status"]="completed"):ExecutionResult=>({
  id:decisionId,decisionId,status,action:"prototype",startedAt:new Date().toISOString(),completedAt:new Date().toISOString(),costChf,output:"test"
});

let view:{cashChf:number;decisions:Decision[];executions:ExecutionResult[]}={cashChf:100,decisions:[decision("d1",30),decision("d2",50)],executions:[]};
assert.equal(policy.reserved(view),80);
assert.equal(policy.available(view,"d1"),20);
assert.equal(policy.authorize(view,"d1",30).authorized,true);
assert.equal(policy.authorize(view,"d1",51).authorized,false);

view={...view,decisions:[decision("d1",30)],executions:[]};
assert.equal(policy.available(view,"d1"),70);
assert.equal(policy.authorize(view,"d1",30).authorized,true);
assert.equal(policy.authorize(view,"d1",31).authorized,false);

view={...view,decisions:[decision("d1",30),decision("d2",50)],executions:[execution("d1",30)]};
assert.equal(policy.reserved(view),50);
assert.equal(policy.available(view,"d2"),50);
assert.equal(policy.authorize(view,"d2",50).authorized,true);

view={...view,decisions:[decision("d1",30,"rejected")],executions:[]};
assert.equal(policy.authorize(view,"d1",1).authorized,false);

console.log(JSON.stringify({status:"passed",cases:4},null,2));