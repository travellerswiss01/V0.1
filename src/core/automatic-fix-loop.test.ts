import {strict as assert} from "node:assert";
import {mkdtempSync,rmSync,writeFileSync,mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {automaticFixLoop} from "../agents/automatic-fix-loop.js";
import type {BuildTask} from "../agents/build-task.js";

const dir=mkdtempSync(join(tmpdir(),"v01-fix-loop-"));
try{
  const workspace=join(dir,"product");
  mkdirSync(workspace,{recursive:true});
  const task:BuildTask={
    id:"decision-fix",decisionId:"decision-fix",opportunityId:"opp-fix",
    title:"Fixable Product",objective:"Build a safe prototype.",
    acceptanceCriteria:["Create a runnable product prototype workspace.","Document the selected opportunity and intended customer."]
  };
  writeFileSync(join(workspace,"ARCHITECTURE.md"),"# Product Architecture\n\n## Objective\nBuild a safe prototype.\n\n## Constraints\n- MVP only\n");\n  writeFileSync(join(workspace,"index.ts"),"export const product=true;\n");
  const checks={build:true,test:true,prototype:true};
  const result=await automaticFixLoop(task,workspace,checks,3);
  assert.equal(result.approved,true);
  assert.equal(result.rounds,1);
  assert.ok(result.fixes.some(x=>x.includes("README.md")));
  console.log(JSON.stringify({status:"passed",rounds:result.rounds}));
}finally{
  rmSync(dir,{recursive:true,force:true});
}
