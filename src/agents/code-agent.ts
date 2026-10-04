import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Decision, ExecutionResult } from "../core/types.js";
import type { BuildTask } from "./build-task.js";

export interface CodeAgentResult {
  workspace:string;
  files:string[];
  checks:{build:boolean;test:boolean};
  output:string;
}

function safeSlug(value:string):string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"prototype";
}

export function runCodeAgent(task:BuildTask, decision:Decision):CodeAgentResult {
  const slug=safeSlug(task.title);
  const workspace=join("workspace","products",slug);
  mkdirSync(workspace,{recursive:true});

  const readme=join(workspace,"README.md");
  const product=join(workspace,"index.ts");
  writeFileSync(readme,[
    "# Product Prototype",
    "",
    `Build task: ${task.id}`,
    `Opportunity: ${task.opportunityId}`,
    `Objective: ${task.objective}`,
    "",
    "## Acceptance criteria",
    ...task.acceptanceCriteria.map(x=>`- ${x}`)
  ].join("\n")+"\n");

  writeFileSync(product,[
    `export const product = {`,
    `  name: ${JSON.stringify(task.title)},`,
    `  opportunityId: ${JSON.stringify(task.opportunityId)},`,
    `  objective: ${JSON.stringify(task.objective)}`,
    "};",
    "",
    "export function healthCheck():boolean { return Boolean(product.name && product.opportunityId); }"
  ].join("\n")+"\n");

  let build=false;
  let test=false;
  try {
    execFileSync("npm",["run","build"],{stdio:"pipe",timeout:120000});
    build=true;
    execFileSync("npm",["test"],{stdio:"pipe",timeout:120000});
    test=true;
  } catch (error) {
    const message=error instanceof Error?error.message:String(error);
    throw new Error(`Code-agent validation failed: ${message}`);
  }

  return {
    workspace,
    files:[readme,product],
    checks:{build,test},
    output:`Code agent created ${workspace}, then passed npm build and npm test.`
  };
}

export function executeCodeAgent(memory:any, decision:Decision):ExecutionResult {
  const startedAt=new Date().toISOString();
  if(decision.status!=="approved" || !decision.approved) {
    const result:ExecutionResult={
      id:decision.id,decisionId:decision.id,status:"blocked",action:decision.action,
      startedAt,completedAt:new Date().toISOString(),costChf:0,
      output:"Code-agent execution blocked: decision is not approved."
    };
    memory.addExecution(result);
    return result;
  }
  try {
    const task=createBuildTask(decision);
    const result=runCodeAgent(task,decision);
    const execution:ExecutionResult={
      id:decision.id,decisionId:decision.id,status:"completed",action:decision.action,
      startedAt,completedAt:new Date().toISOString(),costChf:decision.budgetChf,
      output:result.output
    };
    memory.addExecution(execution);
    return execution;
  } catch(error) {
    const execution:ExecutionResult={
      id:decision.id,decisionId:decision.id,status:"failed",action:decision.action,
      startedAt,completedAt:new Date().toISOString(),costChf:0,
      output:"Code-agent execution failed.",
      error:error instanceof Error?error.message:String(error)
    };
    memory.addExecution(execution);
    return execution;
  }
}