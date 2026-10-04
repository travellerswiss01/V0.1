import type {FailureCode} from "./types.js";

export interface FailureClassification {
  code:FailureCode;
  retryable:boolean;
  recoveryAction:string;
}

export function classifyFailure(error:unknown):FailureClassification {
  const message=error instanceof Error?error.message:String(error);
  const text=message.toLowerCase();

  if(/payment|charge|billing|invoice/.test(text))
    return {code:"payment",retryable:false,recoveryAction:"Escalate to human; no automatic financial retry."};
  if(/legal|contract|lawsuit/.test(text))
    return {code:"legal",retryable:false,recoveryAction:"Escalate to human/legal review."};
  if(/delete|destructive|irreversible/.test(text))
    return {code:"destructive",retryable:false,recoveryAction:"Stop execution and require human approval."};
  if(/policy|not allowed|outside.*workspace|forbidden operation/.test(text))
    return {code:"policy",retryable:false,recoveryAction:"Stop and revise the task within policy."};
  if(/permission|403|forbidden|access denied/.test(text))
    return {code:"permission",retryable:false,recoveryAction:"Escalate; permissions must be fixed before retry."};
  if(/auth|unauthorized|401|api key|token/.test(text))
    return {code:"auth",retryable:false,recoveryAction:"Escalate; credentials/configuration must be fixed."};
  if(/budget|insufficient cash|reserved/.test(text))
    return {code:"budget",retryable:false,recoveryAction:"Stop until budget/cash state changes."};
  if(/approval|not approved/.test(text))
    return {code:"approval",retryable:false,recoveryAction:"Request explicit human approval."};
  if(/timeout|timed out|econnreset|enotfound|network|temporar|rate limit|429/.test(text))
    return {code:"transient",retryable:true,recoveryAction:"Retry with bounded attempts."};
  if(/build|compile|typescript|validation|test failed|assert/.test(text))
    return {code:"validation",retryable:true,recoveryAction:"Diagnose validation output, apply a bounded fix, then retry."};

  return {code:"unknown",retryable:false,recoveryAction:"Escalate with the concrete error; no blind retry."};
}

export interface RetryDecision {
  retry:boolean;
  attempt:number;
  maxAttempts:number;
}

export function nextRetry(attempt:number,maxAttempts:number,classification:FailureClassification):RetryDecision {
  return {retry:classification.retryable && attempt<maxAttempts,attempt,maxAttempts};
}
