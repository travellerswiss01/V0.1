import type {Decision} from "../core/types.js";
import {specificationToPrompt,validateProductSpecification} from "./product-spec.js";
import {Memory} from "../core/memory.js";

export interface BuildTask {
  id:string; decisionId:string; opportunityId:string; title:string; objective:string; acceptanceCriteria:string[];
}

export function createBuildTask(decision:Decision,memory:Memory):BuildTask {
  if(decision.status!=="approved"||!decision.approved){
    throw new Error("Product build gate failed: decision is not approved.");
  }

  const spec=memory.getProductSpecification(decision.id);
  const specificationError=validateProductSpecification(decision,spec);
  if(specificationError) throw new Error(specificationError);
  if(!spec) throw new Error("Product specification gate failed: no persisted specification exists for this decision.");

  return {
    id:decision.id,
    decisionId:decision.id,
    opportunityId:decision.opportunityId,
    title:decision.action,
    objective:specificationToPrompt(spec),
    acceptanceCriteria:spec.acceptanceCriteria
  };
}
