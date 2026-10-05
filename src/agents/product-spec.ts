import type {Decision,Opportunity,ProductSpecification} from "../core/types.js";
import {Memory} from "../core/memory.js";

export function createProductSpecification(memory:Memory,decision:Decision):ProductSpecification{
  const opportunity=memory.snapshot().opportunities.find(item=>item.id===decision.opportunityId);
  if(!opportunity) throw new Error("Opportunity not found for product specification.");
  const spec:ProductSpecification={
    id:`spec-${decision.id}`,decisionId:decision.id,opportunityId:opportunity.id,createdAt:new Date().toISOString(),
    targetCustomer:opportunity.customer,
    problem:`The customer needs a faster, simpler way to solve the recurring task behind "${opportunity.title}".`,
    valueProposition:`Deliver measurable value for ${opportunity.customer} with a small, fast-to-test product priced around CHF ${opportunity.priceChf}.`,
    features:[
      "Simple customer-facing workflow for the core job",
      "Clear result/output that can be evaluated immediately",
      "Basic status or health feedback",
      "Minimal setup suitable for an MVP"
    ],
    userFlow:["Customer opens the product","Customer provides the minimum required input","Product processes the request","Customer receives a useful result","Customer can repeat the workflow"],
    acceptanceCriteria:[
      "Core workflow is runnable end-to-end",
      "Target customer and problem are documented",
      "Input and output are clearly defined",
      "Product has a deterministic health check",
      "Prototype passes TypeScript validation and tests"
    ],
    pricingChf:opportunity.priceChf,
    mvpScope:[
      "Core workflow only",
      "Single primary customer use case",
      "Runnable prototype",
      "Basic documentation and validation"
    ],
    outOfScope:["Payments","Mass outreach","Production deployment","Complex integrations","Advanced analytics"]
  };
  return memory.saveProductSpecification(spec);
}

export function specificationToPrompt(spec:ProductSpecification):string{
  return [
    `Target customer: ${spec.targetCustomer}`,
    `Problem: ${spec.problem}`,
    `Value proposition: ${spec.valueProposition}`,
    `Pricing: CHF ${spec.pricingChf}`,
    "Features:",...spec.features.map(x=>`- ${x}`),
    "User flow:",...spec.userFlow.map((x,i)=>`${i+1}. ${x}`),
    "Acceptance criteria:",...spec.acceptanceCriteria.map(x=>`- ${x}`),
    "MVP scope:",...spec.mvpScope.map(x=>`- ${x}`),
    "Out of scope:",...spec.outOfScope.map(x=>`- ${x}`)
  ].join("\n");
}
