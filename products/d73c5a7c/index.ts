export const product = {
  name: "Validate and prototype: Weekly KPI Report",
  opportunityId: "kpi-report",
  objective: "Validate demand for CHF 39 offer within 1 day(s), with a maximum test budget of CHF 5."
};

export function healthCheck():boolean { return Boolean(product.name && product.opportunityId); }
