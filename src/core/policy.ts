import type { RiskLevel } from "./types.js";
export function classifyRisk(action:string):RiskLevel{
  const a=action.toLowerCase();
  if(/delete|pay|purchase|deploy|legal|contract|send mass|irreversible/.test(a))return "high";
  if(/publish|email|outreach|change pricing|spend|prototype/.test(a))return "medium";
  return "low";
}
export function requiresApproval(risk:RiskLevel){return risk==="high";}