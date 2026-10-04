import { readFileSync,writeFileSync,existsSync,mkdirSync } from "node:fs";
import type { CompanyState,Decision,ExecutionResult,Opportunity,LedgerEntry } from "./types.js";
import {randomUUID} from "node:crypto";
export class Memory{
  private state:CompanyState; private readonly path:string;
  constructor(startingCapital:number,statePath="data/company-state.json"){
    this.path=statePath;
    mkdirSync("data",{recursive:true});
    mkdirSync(this.path.split("/").slice(0,-1).join("/")||".",{recursive:true});
    this.state=existsSync(this.path)?JSON.parse(readFileSync(this.path,"utf8")):{
      cashChf:startingCapital,revenueChf:0,costsChf:0,cycle:0,
      opportunities:[],decisions:[],executions:[],pendingApprovals:[],ledger:[]
    };
    this.state.executions ??=[];
    this.state.ledger ??=[];
    this.save();
  }
  snapshot(){return structuredClone(this.state);}
  setOpportunities(items:Opportunity[]){this.state.opportunities=items;this.save();}
  addDecision(d:Decision){
    this.state.decisions.unshift(d);
    if(d.status==="pending_approval")this.state.pendingApprovals.unshift(d.id);
    this.appendLedger({type:"decision_created",decisionId:d.id,status:d.status,action:d.action,budgetChf:d.budgetChf,risk:d.risk,detail:d.reason});
    this.save();
  }
  approveDecision(id:string):Decision | undefined {
    const decision=this.state.decisions.find(item=>item.id===id);
    if(!decision || decision.status!=="pending_approval") return undefined;
    decision.approved=true;
    decision.status="approved";
    this.appendLedger({type:"decision_approved",decisionId:decision.id,status:decision.status,action:decision.action,budgetChf:decision.budgetChf,risk:decision.risk,detail:"Explicit human approval granted."});
    this.state.pendingApprovals=this.state.pendingApprovals.filter(item=>item!==id);
    this.save();
    return structuredClone(decision);
  }
  addExecution(result:ExecutionResult){
    const existing=this.state.executions.find(item=>item.decisionId===result.decisionId);
    if(existing){return structuredClone(existing);}
    this.state.executions.unshift(result);
    if(result.status==="completed"){
      this.state.cashChf-=result.costChf;
      this.state.costsChf+=result.costChf;
    }
    this.state.pendingApprovals=this.state.pendingApprovals.filter(id=>id!==result.decisionId);
    const decision=this.state.decisions.find(d=>d.id===result.decisionId);
    this.appendLedger({type:"execution_recorded",decisionId:result.decisionId,status:result.status,action:result.action,budgetChf:result.costChf,risk:decision?.risk??"low",detail:result.output});
    this.save();
  }
  reservedBudgetChf():number {
    return this.state.decisions
      .filter(d=>d.status==="approved")
      .filter(d=>!this.state.executions.some(e=>e.decisionId===d.id))
      .reduce((sum,d)=>sum+d.budgetChf,0);
  }
  availableForExecutionChf(decisionId:string):number {
    const decision=this.state.decisions.find(d=>d.id===decisionId);
    const reservedExcludingCurrent=this.state.decisions
      .filter(d=>d.status==="approved" && d.id!==decisionId)
      .filter(d=>!this.state.executions.some(e=>e.decisionId===d.id))
      .reduce((sum,d)=>sum+d.budgetChf,0);
    return this.state.cashChf-reservedExcludingCurrent-(decision?.budgetChf??0);
  }
  getExecutionByDecisionId(decisionId:string):ExecutionResult | undefined {
    const execution=this.state.executions.find(item=>item.decisionId===decisionId);
    return execution?structuredClone(execution):undefined;
  }
  getLedger(){return structuredClone(this.state.ledger);}
  private appendLedger(entry:Omit<LedgerEntry,"id"|"timestamp">){this.state.ledger.unshift({id:randomUUID(),timestamp:new Date().toISOString(),...entry});}
  save(){writeFileSync(this.path,JSON.stringify(this.state,null,2));}
  nextCycle(){this.state.cycle+=1;this.save();}
}