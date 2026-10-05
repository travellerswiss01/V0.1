import {strict as assert} from "node:assert";
import {deriveCeoStrategy} from "./ceo-strategy.js";
import type {CompanyState} from "./types.js";

const base:CompanyState={
  schemaVersion:2,updatedAt:new Date().toISOString(),cashChf:100,revenueChf:0,costsChf:0,cycle:2,
  opportunities:[
    {id:"cheap",title:"Cheap",customer:"x",priceChf:50,mvpDays:1,estimatedCostChf:10,competition:"low",automation:80,score:70,rationale:"fast"},
    {id:"new",title:"New",customer:"x",priceChf:40,mvpDays:2,estimatedCostChf:10,competition:"low",automation:70,score:60,rationale:"new"}
  ],
  decisions:[],executions:[],pendingApprovals:[],ledger:[],notes:[]
};
const strategy=deriveCeoStrategy(base);
assert.equal(strategy.priority,"validate");
assert.ok(strategy.scoreOpportunity(base.opportunities[0])>70);
assert.ok(strategy.scoreOpportunity(base.opportunities[1])>60);

const failed={...base,executions:[{id:"e1",decisionId:"d1",status:"failed",action:"x",startedAt:"",completedAt:"",costChf:5,output:""}],decisions:[{id:"d1",cycle:1,action:"x",reason:"",expectedOutcome:"",confidence:.8,risk:"low",approved:true,createdAt:"",opportunityId:"cheap",opportunityScore:70,alternatives:[],budgetChf:10,status:"approved"}]};
const riskStrategy=deriveCeoStrategy(failed);
assert.equal(riskStrategy.priority,"learn");
assert.ok(riskStrategy.scoreOpportunity(base.opportunities[0])<strategy.scoreOpportunity(base.opportunities[0]));

const successful={...base,
  executions:[{id:"e2",decisionId:"d2",status:"completed",action:"x",startedAt:"",completedAt:"",costChf:8,revenueChf:39,output:""}],
  decisions:[{id:"d2",cycle:1,action:"x",reason:"",expectedOutcome:"",confidence:.9,risk:"low",approved:true,createdAt:"",opportunityId:"cheap",opportunityScore:70,alternatives:[],budgetChf:10,status:"approved"}],
};
const learnedStrategy=deriveCeoStrategy(successful);
assert.equal(learnedStrategy.performance.length,1);
assert.equal(learnedStrategy.performance[0].opportunityId,"cheap");
assert.equal(learnedStrategy.performance[0].successRate,1);
assert.equal(learnedStrategy.performance[0].averageCostChf,8);
assert.equal(learnedStrategy.performance[0].revenueChf,39);
assert.equal(learnedStrategy.performance[0].profitChf,31);
assert.equal(learnedStrategy.performance[0].roi,39/8-1);
assert.ok(learnedStrategy.scoreOpportunity(base.opportunities[0])>strategy.scoreOpportunity(base.opportunities[0]));

const expensiveHistory={...successful,
  executions:[{id:"e3",decisionId:"d2",status:"completed",action:"x",startedAt:"",completedAt:"",costChf:20,revenueChf:0,output:""}],
};
const costAware=deriveCeoStrategy(expensiveHistory);
assert.ok(costAware.scoreOpportunity(base.opportunities[0])<learnedStrategy.scoreOpportunity(base.opportunities[0]));

const repeatedlyTried={...base,
  executions:[
    {id:"e4",decisionId:"d3",status:"completed",action:"x",startedAt:"",completedAt:"",costChf:8,output:""},
    {id:"e5",decisionId:"d4",status:"completed",action:"x",startedAt:"",completedAt:"",costChf:8,output:""},
    {id:"e6",decisionId:"d5",status:"completed",action:"x",startedAt:"",completedAt:"",costChf:8,output:""}
  ],
  decisions:[
    {id:"d3",cycle:1,action:"x",reason:"",expectedOutcome:"",confidence:.9,risk:"low",approved:true,createdAt:"",opportunityId:"cheap",opportunityScore:70,alternatives:[],budgetChf:10,status:"approved"},
    {id:"d4",cycle:2,action:"x",reason:"",expectedOutcome:"",confidence:.9,risk:"low",approved:true,createdAt:"",opportunityId:"cheap",opportunityScore:70,alternatives:[],budgetChf:10,status:"approved"},
    {id:"d5",cycle:3,action:"x",reason:"",expectedOutcome:"",confidence:.9,risk:"low",approved:true,createdAt:"",opportunityId:"cheap",opportunityScore:70,alternatives:[],budgetChf:10,status:"approved"}
  ]
};
const explorationStrategy=deriveCeoStrategy(repeatedlyTried);
assert.ok(explorationStrategy.scoreOpportunity(base.opportunities[1])>explorationStrategy.scoreOpportunity(base.opportunities[0]));

console.log(JSON.stringify({status:"passed",initialPriority:strategy.priority,failurePriority:riskStrategy.priority,learnedSuccessRate:learnedStrategy.performance[0].successRate,revenue:39,profit:31,roi:39/8-1,costAware:true,explorationBias:true}));
