import {execFileSync} from "node:child_process";
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from "node:fs";
import {join,relative,resolve} from "node:path";
import {Agent,run,tool} from "@openai/agents";
import {z} from "zod";
import type {Decision,ExecutionResult} from "../core/types.js";
import {classifyFailure,nextRetry} from "../core/failure.js";
import {createBuildTask} from "./build-task.js";
import type {BuildTask} from "./build-task.js";
import {publishWorkspaceToGitHub} from "./github-publisher.js";
import {reviewCode} from "./code-review.js";
import {ExecutionLock,withExecutionLock} from "../core/execution-lock.js";
import type {Memory} from "../core/memory.js";

export interface CodeAgentResult {
  workspace:string;
  files:string[];
  checks:{build:boolean;test:boolean;prototype:boolean};
  mode:"ai"|"deterministic";
  review:{approved:boolean;score:number;findings:string[];mode:"ai"|"deterministic";summary:string};
  output:string;
  github?:{branch:string;commitSha:string;prNumber:number;prUrl:string};
}

function safeSlug(value:string):string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"prototype";
}

function workspaceFor(task:BuildTask):string {
  return resolve("workspace","products",safeSlug(task.title));
}

function assertWorkspacePath(workspace:string,path:string):string {
  const root=resolve(workspace);
  const target=resolve(workspace,path);
  const rel=relative(root,target);
  if(rel.startsWith("..")||resolve(target)===root) throw new Error("Path outside coding workspace is not allowed.");
  return target;
}

function seedWorkspace(task:BuildTask):{workspace:string;readme:string;product:string;test:string;architecture:string} {
  const workspace=workspaceFor(task);
  mkdirSync(workspace,{recursive:true});
  const readme=join(workspace,"README.md");
  const product=join(workspace,"index.ts");
  const test=join(workspace,"prototype.test.ts");
  const architecture=join(workspace,"ARCHITECTURE.md");

  writeFileSync(readme,[
    "# AI Product Prototype",
    "",
    `Build task: ${task.id}`,
    `Opportunity: ${task.opportunityId}`,
    `Objective: ${task.objective}`,
    "",
    "## Acceptance criteria",
    ...task.acceptanceCriteria.map(x=>`- ${x}`)
  ].join("\n")+ "\n");

  writeFileSync(architecture,[
    "# Product Architecture","",
    "## Objective",task.objective,"",
    "## Components","- Customer input layer","- Core product logic","- Result/output layer","- Health check and validation","",
    "## Constraints","- MVP only","- No payments","- No production deployment","- No destructive operations"
  ].join("\n")+"\n");

  writeFileSync(product,[
    "export const product = {",
    `  name: ${JSON.stringify(task.title)},`,
    `  opportunityId: ${JSON.stringify(task.opportunityId)},`,
    `  objective: ${JSON.stringify(task.objective)}`,
    "};",
    "",
    "export function healthCheck():boolean { return Boolean(product.name && product.opportunityId); }"
  ].join("\n")+ "\n");

  writeFileSync(test,[
    'import {strict as assert} from "node:assert";',
    'import {healthCheck} from "./index.js";',
    "",
    'assert.equal(healthCheck(),true);',
    'console.log("Prototype health check passed.");'
  ].join("\n")+ "\n");

  return {workspace,readme,product,test,architecture};
}

function listFiles(root:string):string[] {
  const result:string[]=[];
  const visit=(dir:string)=>{
    for(const entry of readdirSync(dir,{withFileTypes:true})){
      const full=join(dir,entry.name);
      if(entry.isDirectory()) visit(full);
      else result.push(relative(root,full));
    }
  };
  visit(root);
  return result.sort();
}

function validatePrototype(workspace:string):{build:boolean;test:boolean;prototype:boolean} {
  let build=false;
  let test=false;
  let prototype=false;

  // Validate the company repository, but never run the repository smoke test here.
  // The smoke test starts its own Control Panel server; running it from inside
  // the Control Panel approval test creates a recursive test-server collision.
  execFileSync("npm",["run","build"],{stdio:"pipe",timeout:120000});
  build=true;

  const tsFiles=listFiles(workspace).filter(file=>file.endsWith(".ts"));
  if(tsFiles.length===0) throw new Error("Prototype validation failed: no TypeScript source was created.");

  execFileSync("npx",[
    "tsc","--noEmit","--target","ES2022","--module","NodeNext","--moduleResolution","NodeNext",...tsFiles
  ],{cwd:workspace,stdio:"pipe",timeout:120000});
  prototype=true;

  execFileSync("npx",["tsx","prototype.test.ts"],{cwd:workspace,stdio:"pipe",timeout:120000});
  test=true;

  return {build,test,prototype};
}

export async function runDeterministicCodeAgent(task:BuildTask):Promise<CodeAgentResult> {
  const seeded=seedWorkspace(task);
  const checks=validatePrototype(seeded.workspace);
  const review=await reviewCode(task,seeded.workspace,checks);
  if(!review.approved) throw new Error(`Review gate did not pass: ${review.summary}`);
  const github=process.env.GITHUB_PUBLISH_ENABLED==="true"
    ?await publishWorkspaceToGitHub(seeded.workspace,task.id,task.title,task.objective)
    :undefined;
  return {
    workspace:seeded.workspace,
    files:listFiles(seeded.workspace).map(file=>join(seeded.workspace,file)),
    checks,
    mode:"deterministic",
    review,
    github,
    output:`Deterministic coding agent created ${seeded.workspace}, passed repository build, prototype TypeScript validation and prototype health test${github?" and published a guarded GitHub draft PR.":"."}`
  };
}

export async function runAiCodeAgent(task:BuildTask):Promise<CodeAgentResult> {
  if(!process.env.OPENAI_API_KEY) throw new Error("AI coding agent requires OPENAI_API_KEY.");
  const seeded=seedWorkspace(task);
  const workspace=seeded.workspace;

  const readTool=tool({
    name:"read_workspace_file",
    description:"Read a text file inside the assigned product workspace.",
    parameters:z.object({path:z.string()}),
    execute:async({path})=>readFileSync(assertWorkspacePath(workspace,path),"utf8")
  });

  const writeTool=tool({
    name:"write_workspace_file",
    description:"Create or replace a text file inside the assigned product workspace. Never use paths outside the workspace.",
    parameters:z.object({path:z.string(),content:z.string()}),
    execute:async({path,content})=>{
      const target=assertWorkspacePath(workspace,path);
      mkdirSync(resolve(target,".."),{recursive:true});
      writeFileSync(target,content);
      return `Wrote ${relative(workspace,target)}`;
    }
  });

  const listTool=tool({
    name:"list_workspace_files",
    description:"List files currently present in the assigned product workspace.",
    parameters:z.object({}),
    execute:async()=>listFiles(workspace)
  });

  const validateTool=tool({
    name:"validate_prototype",
    description:"Run the repository build and the prototype TypeScript/health checks. Do not run the repository smoke test.",
    parameters:z.object({}),
    execute:async()=>{
      try {
        return JSON.stringify({ok:true,checks:validatePrototype(workspace)});
      } catch(error) {
        return JSON.stringify({ok:false,error:error instanceof Error?error.message:String(error)});
      }
    }
  });

  const agent=new Agent({
    name:"Autonomous Coding Agent",
    model:process.env.AI_CODING_AGENT_MODEL||"gpt-5.4",
    instructions:[
      "You are the product coding agent inside an autonomous company.",
      "Work only inside the assigned product workspace.",
      "Inspect the existing files first, then implement the smallest useful runnable prototype for the business task.",
      "You may create or modify text/source files only through the provided workspace tools.",
      "Do not use external packages, secrets, network access, deployment, payments, legal actions, or destructive operations.",
      "Keep the prototype self-contained and understandable.",
      "First inspect the workspace and architecture, then implement the smallest useful runnable prototype for the specification.",
      "You must call validate_prototype before declaring success.",
      "Use a bounded repair loop: after a validation failure, diagnose the concrete error, make a focused fix, and validate again. Never perform more than 5 repair validations.",
      "If validation fails, inspect the error, fix the code, and validate again.",
      "Do not claim success unless validate_prototype reports ok:true."
    ].join("\n"),
    tools:[readTool,writeTool,listTool,validateTool]
  });

  const result=await run(agent,[
    `Build task: ${task.title}`,
    `Opportunity: ${task.opportunityId}`,
    `Objective: ${task.objective}`,
    "Acceptance criteria:",
    ...task.acceptanceCriteria.map(x=>`- ${x}`),
    `Workspace: ${workspace}`,
    "Repair budget: maximum 5 validation/fix iterations."
  ].join("\n"),{maxTurns:16});

  let checks:{build:boolean;test:boolean;prototype:boolean};
  try {
    checks=validatePrototype(workspace);
  } catch(error) {
    throw new Error(`AI coding agent final validation failed: ${error instanceof Error?error.message:String(error)}`);
  }

  const github=process.env.GITHUB_PUBLISH_ENABLED==="true"
    ?await publishWorkspaceToGitHub(workspace,task.id,task.title,task.objective)
    :undefined;
  return {
    workspace,
    files:listFiles(workspace).map(file=>join(workspace,file)),
    checks,
    mode:"ai",
    github,
    output:`AI coding agent completed the prototype in ${workspace}. ${result.finalOutput??"No final summary returned."}`
  };
}

export async function executeCodeAgent(memory:{
  addExecution:(result:ExecutionResult)=>ExecutionResult|void;
  getExecutionByDecisionId?:(decisionId:string)=>ExecutionResult|undefined;
  authorizeSpend?:(decisionId:string,amountChf:number)=>{authorized:boolean;reason:string};
  recordFailure?:(decisionId:string,action:string,risk:Decision["risk"],budgetChf:number,entry:{
    type:"execution_failed"|"execution_retry_scheduled"|"execution_recovered";
    status:string; detail:string;
  })=>void;
},decision:Decision):Promise<ExecutionResult> {
  const existing=memory.getExecutionByDecisionId?.(decision.id);
  if(existing)return existing;

  const startedAt=new Date().toISOString();
  const maxAttempts=3;
  const lock=new ExecutionLock("data/execution.lock");

  if(decision.status!=="approved"||!decision.approved){
    const result:ExecutionResult={
      id:decision.id,decisionId:decision.id,status:"blocked",action:decision.action,
      startedAt,completedAt:new Date().toISOString(),costChf:0,
      output:"Code-agent execution blocked: decision is not approved.",
      attempt:1,maxAttempts
    };
    memory.addExecution(result);
    return result;
  }

  return withExecutionLock(lock,decision.id,async()=>{
  const authorization=memory.authorizeSpend?.(decision.id,decision.budgetChf);
  if(authorization && !authorization.authorized){
    const result:ExecutionResult={
      id:decision.id,decisionId:decision.id,status:"failed",action:decision.action,
      startedAt,completedAt:new Date().toISOString(),costChf:0,
      output:"Code-agent execution blocked by Budget 2.0.",
      error:authorization.reason,attempt:1,maxAttempts,failureCode:"budget",retryable:false
    };
    memory.addExecution(result);
    return result;
  }
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{
      const task=createBuildTask(decision,memory as Memory);
      const aiEnabled=process.env.AI_CODING_AGENT_ENABLED==="true";
      const result=aiEnabled?await runAiCodeAgent(task):await runDeterministicCodeAgent(task);
      const execution:ExecutionResult={
        id:decision.id,decisionId:decision.id,status:"completed",action:decision.action,
        startedAt,completedAt:new Date().toISOString(),costChf:decision.budgetChf,
        output:result.output,
        attempt,maxAttempts,
        artifacts:{
          workspace:result.workspace,
          files:result.files,
          checks:result.checks,
          mode:result.mode,
          github:result.github
        }
      };
      if(attempt>1){
        memory.recordFailure?.(decision.id,decision.action,decision.risk,decision.budgetChf,{
          type:"execution_recovered",status:"recovered",
          detail:`Execution recovered successfully on attempt ${attempt}/${maxAttempts}.`
        });
      }
      memory.addExecution(execution);
      return execution;
    }catch(error){
      const classification=classifyFailure(error);
      const retry=nextRetry(attempt,maxAttempts,classification);
      memory.recordFailure?.(decision.id,decision.action,decision.risk,decision.budgetChf,{
        type:"execution_failed",status:classification.code,
        detail:`Attempt ${attempt}/${maxAttempts} failed: ${error instanceof Error?error.message:String(error)} Recovery: ${classification.recoveryAction}`
      });

      if(retry.retry){
        memory.recordFailure?.(decision.id,decision.action,decision.risk,decision.budgetChf,{
          type:"execution_retry_scheduled",status:"retry_scheduled",
          detail:`Bounded retry scheduled after attempt ${attempt}/${maxAttempts}; failure code ${classification.code}.`
        });
        continue;
      }

      const execution:ExecutionResult={
        id:decision.id,decisionId:decision.id,status:"failed",action:decision.action,
        startedAt,completedAt:new Date().toISOString(),costChf:0,
        output:`Code-agent execution failed after ${attempt}/${maxAttempts} attempt(s).`,
        error:error instanceof Error?error.message:String(error),
        attempt,maxAttempts,failureCode:classification.code,retryable:classification.retryable
      };
      memory.addExecution(execution);
      return execution;
    }
  }

  throw new Error("Failure engine exhausted without producing an execution result.");
  });
}
