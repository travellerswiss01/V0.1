import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {Agent,run,tool} from "@openai/agents";
import {z} from "zod";
import type {BuildTask} from "./build-task.js";
import {reviewCode,type CodeReviewResult} from "./code-review.js";

export interface AutomaticFixResult {
  approved:boolean;
  rounds:number;
  review:CodeReviewResult;
  mode:"ai"|"deterministic";
  fixes:string[];
}

function safePath(workspace:string,path:string):string {
  const root=workspace.endsWith("/")?workspace:workspace+"/";
  const target=join(workspace,path);
  if(!target.startsWith(root)||target===workspace) throw new Error("Fix path outside workspace is not allowed.");
  return target;
}

function deterministicFix(task:BuildTask,workspace:string,review:CodeReviewResult):string[] {
  const fixes:string[]=[];
  for(const finding of review.findings){
    if(finding.title==="README missing"){
      const path=safePath(workspace,"README.md");
      writeFileSync(path,["# AI Product Prototype","","## Acceptance criteria",...task.acceptanceCriteria.map(x=>"- "+x)].join("\n")+"\n");
      fixes.push("Created missing README.md.");
    } else if(finding.title==="Architecture missing"){
      const path=safePath(workspace,"ARCHITECTURE.md");
      writeFileSync(path,["# Product Architecture","","## Objective",task.objective,"","## Constraints","- MVP only","- No payments","- No production deployment","- No destructive operations"].join("\n")+"\n");
      fixes.push("Created missing ARCHITECTURE.md.");
    } else if(finding.title==="Acceptance criteria undocumented"){
      const path=safePath(workspace,"README.md");
      const current=readFileSync(path,"utf8");
      if(!current.includes("Acceptance criteria")) writeFileSync(path,current+"\n## Acceptance criteria\n"+task.acceptanceCriteria.map(x=>"- "+x).join("\n")+"\n");
      fixes.push("Added acceptance criteria to README.md.");
    } else if(finding.title==="Architecture incomplete"){
      const path=safePath(workspace,"ARCHITECTURE.md");
      const current=readFileSync(path,"utf8");
      if(!current.includes("## Objective")) writeFileSync(path,current+"\n## Objective\n"+task.objective+"\n");
      if(!current.includes("## Constraints")) writeFileSync(path,readFileSync(path,"utf8")+"\n## Constraints\n- MVP only\n- No destructive operations\n");
      fixes.push("Completed architecture documentation.");
    }
  }
  return fixes;
}

export async function automaticFixLoop(task:BuildTask,workspace:string,checks:{build:boolean;test:boolean;prototype:boolean},maxRounds=3):Promise<AutomaticFixResult>{
  let review=await reviewCode(task,workspace,checks);
  const fixes:string[]=[];
  if(review.approved)return {approved:true,rounds:0,review,mode:"deterministic",fixes};

  for(let round=1;round<=maxRounds;round++){
    let roundFixes=deterministicFix(task,workspace,review);
    let mode:"ai"|"deterministic"="deterministic";

    if(process.env.AI_CODE_REVIEW_ENABLED==="true"&&process.env.OPENAI_API_KEY){
      const writeTool=tool({
        name:"write_fix_file",
        description:"Write a focused fix to a text file inside the assigned workspace.",
        parameters:z.object({path:z.string(),content:z.string()}),
        execute:async({path,content})=>{writeFileSync(safePath(workspace,path),content);return "fixed "+path;}
      });
      const readTool=tool({
        name:"read_fix_file",
        description:"Read a file inside the assigned workspace.",
        parameters:z.object({path:z.string()}),
        execute:async({path})=>readFileSync(safePath(workspace,path),"utf8")
      });
      const agent=new Agent({
        name:"Automatic Fix Agent",
        model:process.env.AI_CODING_AGENT_MODEL||"gpt-5.4",
        instructions:"Apply only focused fixes required by the independent review. Never deploy, pay, use network, modify secrets, or perform destructive operations. Do not expand scope.",
        tools:[readTool,writeTool]
      });
      await run(agent,[`Workspace: ${workspace}`,`Objective: ${task.objective}`,"Review findings:",...review.findings.map(x=>`- [${x.severity}] ${x.title}: ${x.detail}`)].join("\n"),{maxTurns:8});
      mode="ai";
      roundFixes.push("AI fix agent applied focused review fixes.");
    }

    fixes.push(...roundFixes);
    if(roundFixes.length===0) break;

    // The caller supplies fresh checks after a build/test validation.
    // For the fix loop itself, review safety/documentation state without claiming validation success.
    review=await reviewCode(task,workspace,checks);
    if(review.approved)return {approved:true,rounds:round,review,mode,fixes};
  }

  return {approved:false,rounds:maxRounds,review,mode:process.env.AI_CODE_REVIEW_ENABLED==="true"?"ai":"deterministic",fixes};
}
