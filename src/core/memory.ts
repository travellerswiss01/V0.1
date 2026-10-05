import { readFileSync,writeFileSync,existsSync,mkdirSync,renameSync } from "node:fs";
import {dirname} from "node:path";
import {randomUUID} from "node:crypto";
import type {CompanyState,Decision,ExecutionResult,Opportunity,LedgerEntry,MemoryNote} from "./types.js";
import {BudgetPolicy} from "./budget.js";

const SCHEMA_VERSION=2;

export class Memory{
  private state:CompanyState; private readonly path:string; private readonly budgetPolicy=new BudgetPolicy();

  constructor(startingCapital:number,statePath="data/company-state.json"){
    this.path=statePath;
    mkdirSync(dirname(statePath),{recursive:true});
    this.state=this.load(startingCapital);
    this.save();
  }

  private load(startingCapital:number):CompanyState{
    if(!existsSync(this.path)) return this.emptyState(startingCapital);
    const parsed=JSON.parse(readFileSync(this.path,"utf8")) as Partial<CompanyState>;
    return this.migrate(parsed,startingCapital);
  }

  private emptyState(startingCapital:number):CompanyState{
    return {schemaVersion:SCHEMA_VERSION,updatedAt:new Date().toISOString(),cashChf:startingCapital,
      revenueChf:0,costsChf:0,cycle:0,opportunities:[],decisions:[],executions:[],
      pendingApprovals:[],ledger:[],notes:[]};
  }

  private migrate(input:Partial<CompanyState>,startingCapital:number):CompanyState{
    const base=this.emptyState(startingCapital);
    const migrated:CompanyState={...base,...input,schemaVersion:SCHEMA_VERSION,updatedAt:new Date().toISOString()};
    migrated.opportunities ??=[]; migrated.decisions ??=[]; migrated.executions ??=[];
    migrated.pendingApprovals ??=[]; migrated.ledger ??=[]; migrated.notes ??=[];
    return migrated;
  }

  snapshot(){return structuredClone(this.state);}
  setOpportunities(items:Opportunity[]){this.state.opportunities=structuredClone(items);this.save();}

  addDecision(d:Decision){
    this.state.decisions.unshift(structuredClone(d));
    if(d.status==="pending_approval"&&!this.state.pendingApprovals.includes(d.id)) this.state.pendingApprovals.unshift(d.id);
    this.appendLedger({type:"decision_created",decisionId:d.id,status:d.status,action:d.action,budgetChf:d.budgetChf,risk:d.risk,detail:d.reason});
    this.save();
  }

  approveDecision(id:string):Decision|undefined{
    const decision=this.state.decisions.find(item=>item.id===id);
    if(!decision||decision.status!=="pending_approval") return undefined;
    const authorization=this.budgetPolicy.authorize(this.state,id,decision.budgetChf);
    if(!authorization.authorized) return undefined;
    decision.approved=true; decision.status="approved";
    this.appendLedger({type:"decision_approved",decisionId:id,status:"approved",action:decision.action,budgetChf:decision.budgetChf,risk:decision.risk,detail:"Explicit human approval granted within current budget."});
    this.state.pendingApprovals=this.state.pendingApprovals.filter(item=>item!==id);
    this.save(); return structuredClone(decision);
  }

  addExecution(result:ExecutionResult){
    const existing=this.state.executions.find(item=>item.decisionId===result.decisionId);
    if(existing) return structuredClone(existing);
    if(result.status==="completed"){
      const authorization=this.budgetPolicy.authorize(this.state,result.decisionId,result.costChf);
      if(!authorization.authorized) throw new Error(`Budget authorization denied: ${authorization.reason}`);
      this.state.cashChf-=result.costChf;
      this.state.costsChf+=result.costChf;
      this.state.revenueChf+=Math.max(0,result.revenueChf??0);
    }
    this.state.executions.unshift(structuredClone(result));
    this.state.pendingApprovals=this.state.pendingApprovals.filter(id=>id!==result.decisionId);
    const decision=this.state.decisions.find(d=>d.id===result.decisionId);
    this.appendLedger({type:"execution_recorded",decisionId:result.decisionId,status:result.status,action:result.action,budgetChf:result.costChf,risk:decision?.risk??"low",detail:result.output});
    this.save(); return structuredClone(result);
  }

  addNote(category:MemoryNote["category"],text:string,source:MemoryNote["source"]="system"):MemoryNote{
    const note:MemoryNote={id:randomUUID(),createdAt:new Date().toISOString(),category,text:text.trim(),cycle:this.state.cycle,source};
    if(!note.text) throw new Error("Memory note cannot be empty.");
    this.state.notes.unshift(note); this.save(); return structuredClone(note);
  }

  private recordExecutionLearning(result:ExecutionResult,decision?:Decision){
    const existing=this.state.notes.find(note=>note.executionId===result.id);
    if(existing) return;
    const opportunityId=decision?.opportunityId;
    const opportunity=this.state.opportunities.find(item=>item.id===opportunityId);
    const history=this.state.executions.filter(item=>item.decisionId===result.decisionId);
    const attempts=history.length;
    const successes=history.filter(item=>item.status==="completed").length;
    const successRate=attempts?successes/attempts:0;
    const cost=history.reduce((sum,item)=>sum+item.costChf,0);
    const revenue=history.reduce((sum,item)=>sum+Math.max(0,item.revenueChf??0),0);
    const profit=revenue-cost;
    const roi=cost===0?0:profit/cost;
    const economics=profit>0?"positive economics":profit<0?"negative economics":"break-even economics";
    const conclusion=result.status==="completed"
      ? `Execution completed with ${economics}.`
      : result.status==="failed"
        ? "Execution failed; learn before increasing scope or spend."
        : "Execution was blocked; resolve the blocker before retrying.";
    const recommendation=result.status==="completed"&&profit>0
      ? "Repeat or grow the opportunity with a controlled next test."
      : result.status==="completed"
        ? "Validate demand or pricing before spending more."
        : "Investigate the failure or blocker with the cheapest reversible test.";
    const title=opportunity?.title??decision?.opportunityId??"unknown opportunity";
    this.addNote("learning",
      `Execution ${result.id}: opportunity "${title}" (${opportunityId??"unknown"}). Attempts ${attempts}; success rate ${Math.round(successRate*100)}%; cost CHF ${cost.toFixed(2)}; revenue CHF ${revenue.toFixed(2)}; profit CHF ${profit.toFixed(2)}; ROI ${(roi*100).toFixed(1)}%. ${conclusion} Next: ${recommendation}`,
      "execution",{executionId:result.id,opportunityId});
  }

  searchNotes(query:string,limit=10):MemoryNote[]{
    const q=query.trim().toLowerCase();
    if(!q) return [];
    return this.state.notes.filter(n=>n.text.toLowerCase().includes(q)||n.category.includes(q)).slice(0,limit).map(n=>structuredClone(n));
  }

  recentNotes(limit=10):MemoryNote[]{return this.state.notes.slice(0,Math.max(0,limit)).map(n=>structuredClone(n));}
  authorizeSpend(decisionId:string,amountChf:number){return this.budgetPolicy.authorize(this.state,decisionId,amountChf);}
  reservedBudgetChf():number{return this.budgetPolicy.reserved(this.state);}
  availableForExecutionChf(decisionId:string):number{return this.budgetPolicy.available(this.state,decisionId);}

  recordFailure(decisionId:string,action:string,risk:Decision["risk"],budgetChf:number,entry:{type:"execution_failed"|"execution_retry_scheduled"|"execution_recovered";status:string;detail:string}){
    this.appendLedger({type:entry.type,decisionId,status:entry.status,action,budgetChf,risk,detail:entry.detail}); this.save();
  }

  getExecutionByDecisionId(decisionId:string):ExecutionResult|undefined{
    const execution=this.state.executions.find(item=>item.decisionId===decisionId); return execution?structuredClone(execution):undefined;
  }
  getLedger(){return structuredClone(this.state.ledger);}
  private appendLedger(entry:Omit<LedgerEntry,"id"|"timestamp">){this.state.ledger.unshift({id:randomUUID(),timestamp:new Date().toISOString(),...entry});}
  save(){
    this.state.updatedAt=new Date().toISOString();
    const temp=`${this.path}.tmp-${process.pid}`;
    writeFileSync(temp,JSON.stringify(this.state,null,2),"utf8");
    renameSync(temp,this.path);
  }
  nextCycle(){this.state.cycle+=1;this.save();}
}