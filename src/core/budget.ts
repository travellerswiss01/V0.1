import type {Decision,ExecutionResult} from "./types.js";

export type SpendingClass = "prototype"|"infrastructure"|"marketing"|"sales"|"payment"|"other";

export interface BudgetView {
  cashChf:number;
  decisions:Decision[];
  executions:ExecutionResult[];
}

export interface SpendAuthorization {
  authorized:boolean;
  availableChf:number;
  reservedChf:number;
  reason:string;
}

export class BudgetPolicy {
  reserved(view:BudgetView,excludeDecisionId?:string):number {
    return view.decisions
      .filter(d=>d.status==="approved")
      .filter(d=>!excludeDecisionId||d.id!==excludeDecisionId)
      .filter(d=>!view.executions.some(e=>e.decisionId===d.id))
      .reduce((sum,d)=>sum+d.budgetChf,0);
  }

  available(view:BudgetView,decisionId?:string):number {
    const decision=view.decisions.find(d=>d.id===decisionId);
    const reservedExcludingCurrent=this.reserved(view,decisionId);
    return view.cashChf-reservedExcludingCurrent-(decision?.budgetChf??0);
  }

  authorize(view:BudgetView,decisionId:string,amountChf:number):SpendAuthorization {
    const decision=view.decisions.find(d=>d.id===decisionId);
    if(!decision) return {authorized:false,availableChf:view.cashChf,reservedChf:this.reserved(view),reason:"Decision does not exist."};
    if(decision.status!=="approved"||!decision.approved)
      return {authorized:false,availableChf:this.available(view,decisionId),reservedChf:this.reserved(view,decisionId),"reason":"Decision is not approved."};
    if(!Number.isFinite(amountChf)||amountChf<0)
      return {authorized:false,availableChf:this.available(view,decisionId),reservedChf:this.reserved(view,decisionId),reason:"Spend amount must be a finite non-negative number."};
    if(amountChf>decision.budgetChf)
      return {authorized:false,availableChf:this.available(view,decisionId),reservedChf:this.reserved(view,decisionId),reason:"Spend exceeds the decision budget."};

    const availableBeforeCurrent=view.cashChf-this.reserved(view,decisionId);
    if(amountChf>availableBeforeCurrent)
      return {authorized:false,availableChf:availableBeforeCurrent,reservedChf:this.reserved(view,decisionId),reason:"Spend would exceed available cash after existing reservations."};

    return {authorized:true,availableChf:availableBeforeCurrent-amountChf,reservedChf:this.reserved(view,decisionId),reason:"Spend authorized within cash and decision budget."};
  }
}
