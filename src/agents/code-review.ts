import {readFileSync,readdirSync} from "node:fs";
import {join,relative} from "node:path";
import {Agent,run,tool} from "@openai/agents";
import {z} from "zod";
import type {BuildTask} from "./build-task.js";

export interface CodeReviewFinding {
  severity:"low"|"medium"|"high";
  title:string;
  detail:string;
  requiredFix:boolean;
}

export interface CodeReviewResult {
  approved:boolean;
  score:number;
  findings:CodeReviewFinding[];
  mode:"ai"|"deterministic";
  summary:string;
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

function readIfExists(workspace:string,path:string):string {
  try{return readFileSync(join(workspace,path),"utf8");}catch{return "";}
}

export function reviewDeterministic(task:BuildTask,workspace:string,checks:{build:boolean;test:boolean;prototype:boolean}):CodeReviewResult {
  const files=listFiles(workspace);
  const findings:CodeReviewFinding[]=[];
  const architecture=readIfExists(workspace,"ARCHITECTURE.md");
  const readme=readIfExists(workspace,"README.md");

  if(!files.includes("ARCHITECTURE.md")) findings.push({severity:"high",title:"Architecture missing",detail:"ARCHITECTURE.md is required for an auditable prototype.",requiredFix:true});
  if(!files.includes("README.md")) findings.push({severity:"high",title:"README missing",detail:"README.md is required to document the prototype.",requiredFix:true});
  if(!files.some(x=>x.endsWith(".ts"))) findings.push({severity:"high",title:"Source missing",detail:"No TypeScript source file was found.",requiredFix:true});
  if(!checks.build||!checks.prototype||!checks.test) findings.push({severity:"high",title:"Validation incomplete",detail:"Build, TypeScript validation and prototype test must all pass.",requiredFix:true});
  if(!readme.includes("Acceptance criteria")) findings.push({severity:"medium",title:"Acceptance criteria undocumented",detail:"README must contain the acceptance criteria section.",requiredFix:true});
  if(!architecture.includes("Objective")||!architecture.includes("Constraints")) findings.push({severity:"medium",title:"Architecture incomplete",detail:"Architecture must document objective and constraints.",requiredFix:true});

  const forbidden=/\b(process\.env|fetch\(|https?:\/\/|child_process|execSync\(|spawn\(|rm\s+-rf|sudo\b)\b/i;
  for(const file of files.filter(x=>x.endsWith(".ts"))){
    const content=readIfExists(workspace,file);
    if(forbidden.test(content)){
      findings.push({severity:"high",title:"Unsafe capability detected",detail:`Potential external secret/network/process/destructive capability in ${file}.`,requiredFix:true});
    }
  }

  const requiredCriteria=task.acceptanceCriteria.filter(x=>x.trim().length>0);
  const missingCriteria=requiredCriteria.filter(criteria=>!readme.toLowerCase().includes(criteria.toLowerCase()));
  if(missingCriteria.length>0){
    findings.push({severity:"medium",title:"Acceptance criteria mismatch",detail:`${missingCriteria.length} acceptance criterion/criteria are not documented verbatim in README.`,requiredFix:true});
  }

  const high=findings.filter(x=>x.severity==="high").length;
  const medium=findings.filter(x=>x.severity==="medium").length;
  const score=Math.max(0,100-high*35-medium*12-findings.filter(x=>x.severity==="low").length*3);
  const approved=high===0&&medium===0&&checks.build&&checks.test&&checks.prototype;
  return {
    approved,
    score,
    findings,
    mode:"deterministic",
    summary:approved?"Independent deterministic review passed: prototype meets validation, documentation and safety gates.":"Independent deterministic review failed: required fixes remain."
  };
}

export async function reviewWithAi(task:BuildTask,workspace:string,checks:{build:boolean;test:boolean;prototype:boolean}):Promise<CodeReviewResult> {
  if(!process.env.OPENAI_API_KEY) return reviewDeterministic(task,workspace,checks);

  const readTool=tool({
    name:"read_review_file",
    description:"Read a text file from the assigned product workspace.",
    parameters:z.object({path:z.string()}),
    execute:async({path})=>readIfExists(workspace,path)
  });
  const listTool=tool({
    name:"list_review_files",
    description:"List files in the assigned product workspace.",
    parameters:z.object({}),
    execute:async()=>listFiles(workspace)
  });

  const agent=new Agent({
    name:"Independent Code Review Agent",
    model:process.env.AI_CODE_REVIEW_MODEL||"gpt-5.4",
    instructions:[
      "You are an independent code reviewer. Never modify files.",
      "Review the prototype against the build objective and acceptance criteria.",
      "Inspect architecture, implementation, documentation and obvious safety/scope issues.",
      "Do not request deployment, payments, legal actions, external network access or destructive changes.",
      "Return concise findings and a recommendation. A review is approved only when all acceptance criteria are satisfied and no high-risk issue remains."
    ].join("\n"),
    tools:[readTool,listTool]
  });

  const result=await run(agent,[
    `Build task: ${task.title}`,
    `Objective: ${task.objective}`,
    "Acceptance criteria:",...task.acceptanceCriteria.map(x=>`- ${x}`),
    `Validation checks: build=${checks.build}, test=${checks.test}, prototype=${checks.prototype}`,
    "Workspace review files are available through tools."
  ].join("\n"),{maxTurns:8});

  const base=reviewDeterministic(task,workspace,checks);
  const output=result.finalOutput??"";
  const aiReject=/\b(reject|failed|fail|not approved|unsafe|missing|bug|critical)\b/i.test(output);
  return {
    approved:base.approved&&!aiReject,
    score:base.approved?(aiReject?70:100):base.score,
    findings:base.findings,
    mode:"ai",
    summary:`${base.summary} AI reviewer: ${output.slice(0,1200)}`
  };
}

export async function reviewCode(task:BuildTask,workspace:string,checks:{build:boolean;test:boolean;prototype:boolean}):Promise<CodeReviewResult> {
  return process.env.AI_CODE_REVIEW_ENABLED==="true"
    ?reviewWithAi(task,workspace,checks)
    :reviewDeterministic(task,workspace,checks);
}
