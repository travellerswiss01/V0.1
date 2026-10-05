import type {CompanyState,LedgerEntry} from "./types.js";

export function activity(state:CompanyState):LedgerEntry[]{return state.ledger.slice(0,20);}
export function products(state:CompanyState){
  return state.opportunities.slice(0,10).map(o=>({
    id:o.id,title:o.title,customer:o.customer,priceChf:o.priceChf,score:o.score,
    status:state.decisions.some(d=>d.opportunityId===o.id&&d.status==="approved")?"selected":"candidate"
  }));
}
export function repairs(state:CompanyState):LedgerEntry[]{
  return state.ledger.filter(e=>e.type==="execution_failed"||e.type==="execution_retry_scheduled"||e.type==="execution_recovered").slice(0,20);
}
