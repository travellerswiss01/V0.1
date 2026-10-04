import { readFileSync,writeFileSync,existsSync,mkdirSync } from "node:fs";
import type { CompanyState,Decision,ExecutionResult,Opportunity } from "./types.js";
export class Memory{
  private state:CompanyState; private readonly path="data/company-state.json";
  constructor(startingCapital:number){
    mkdirSync("data",{recursive:true});
    this.state=existsSync(this.path)?JSON.parse(readFileSync(this.path,"utf8")):{
      cashChf:startingCapital,revenueChf:0,costsChf:0,cycle:0,
      opportunities:[],decisions:[],executions:[],pendingApprovals:[]
    };
    this.state.executions ??=[];
    this.save();
  }
  snapshot(){return structuredClone(this.state);}
  setOpportunities(items:Opportunity[]){this.state.opportunities=items;this.save();}
  addDecision(d:Decision){this.state.decisions.unshift(d);if(d.status==="pending_approval")this.state.pendingApprovals.unshift(d.id);this.save();}
  addExecution(result:ExecutionResult){
    this.state.executions.unshift(result);
    if(result.status==="completed"){
      this.state.cashChf-=result.costChf;
      this.state.costsChf+=result.costChf;
    }
    this.state.pendingApprovals=this.state.pendingApprovals.filter(id=>id!==result.decisionId);
    this.save();
  }
  save(){writeFileSync(this.path,JSON.stringify(this.state,null,2));}
  nextCycle(){this.state.cycle+=1;this.save();}
}