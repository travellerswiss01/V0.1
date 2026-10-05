import type {Decision} from "../core/types.js";
import {specificationToPrompt} from "./product-spec.js";
import {Memory} from "../core/memory.js";

export interface BuildTask {
  id:string; decisionId:string; opportunityId:string; title:string; objective:string; acceptanceCriteria:string[];
}

export function createBuildTask(decision:Decision,memory:Memory):BuildTask {
  if(decision.status!=="approved"||!decision.approved){
    throw new Error("Product build gate failed: decision is not approved.");
  }

  const spec=memory.getProductSpecification(decision.id);
  if(!spec) throw new Error("Product specification gate failed: no persisted specification exists for this decision.");

  if(spec.decisionId!==decision.id){
    throw new Error("Product specification gate failed: specification does not belong to this decision.");
  }

  if(spec.opportunityId!==decision.opportunityId){
    throw new Error("Product specification gate failed: specification does not match the decision opportunity.");
  }

  if(!spec.acceptanceCriteria.length){
    throw new Error("Product specification gate failed: acceptance criteria are required.");
  }

  return {
    id:decision.id,
    decisionId:decision.id,
    opportunityId:decision.opportunityId,
    title:decision.action,
    objective:specificationToPrompt(spec),
    acceptanceCriteria:spec.acceptanceCriteria
  };
}
