import type { Decision } from "../core/types.js";
import {createProductSpecification,specificationToPrompt} from "./product-spec.js";
import {Memory} from "../core/memory.js";

export interface BuildTask {
  id:string; decisionId:string; opportunityId:string; title:string; objective:string; acceptanceCriteria:string[];
}

export function createBuildTask(decision:Decision,memory?:Memory):BuildTask {
  const spec=memory?createProductSpecification(memory,decision):undefined;
  return {
    id:decision.id,
    decisionId:decision.id,
    opportunityId:decision.opportunityId,
    title:decision.action,
    objective:spec?specificationToPrompt(spec):decision.expectedOutcome,
    acceptanceCriteria:spec?.acceptanceCriteria??[
      "Create a runnable product prototype workspace.",
      "Document the selected opportunity and intended customer.",
      "Run the repository build and test suite before reporting success."
    ]
  };
}
