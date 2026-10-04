import type { Decision } from "../core/types.js";

export interface BuildTask {
  id:string;
  decisionId:string;
  opportunityId:string;
  title:string;
  objective:string;
  acceptanceCriteria:string[];
}

export function createBuildTask(decision:Decision):BuildTask {
  return {
    id:decision.id,
    decisionId:decision.id,
    opportunityId:decision.opportunityId,
    title:decision.action,
    objective:decision.expectedOutcome,
    acceptanceCriteria:[
      "Create a runnable product prototype workspace.",
      "Document the selected opportunity and intended customer.",
      "Run the repository build and test suite before reporting success."
    ]
  };
}