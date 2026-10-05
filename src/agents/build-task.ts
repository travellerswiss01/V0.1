import type {Decision} from "../core/types.js";
import {specificationToPrompt} from "./product-spec.js";
import {Memory} from "../core/memory.js";

export interface BuildTask {
  id:string; decisionId:string; opportunityId:string; title:string; objective:string; acceptanceCriteria:string[];
}

export function createBuildTask(decision:Decision,memory:Memory):BuildTask {
  const spec=memory.getProductSpecification(decision.id);
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
