import {strict as assert} from "node:assert";
import {mkdtempSync,rmSync,writeFileSync,mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {reviewDeterministic} from "../agents/code-review.js";
import type {BuildTask} from "../agents/build-task.js";

const dir=mkdtempSync(join(tmpdir(),"v01-code-review-"));
try{
  const workspace=join(dir,"product");
  mkdirSync(workspace,{recursive:true});
  const task:BuildTask={
    id:"decision-1",decisionId:"decision-1",opportunityId:"opp-1",
    title:"Test Product",objective:"Build a safe prototype.",
    acceptanceCriteria:["Create a runnable product prototype workspace.","Document the selected opportunity and intended customer."]
  };
  writeFileSync(join(workspace,"ARCHITECTURE.md"),"# Product Architecture\n\n## Objective\nBuild a safe prototype.\n\n## Constraints\n- MVP only\n");
  writeFileSync(join(workspace,"README.md"),"# Product Prototype\n\n## Acceptance criteria\n- Create a runnable product prototype workspace.\n- Document the selected opportunity and intended customer.\n");
  writeFileSync(join(workspace,"index.ts"),"export const ok=true;\n");
  const passed=reviewDeterministic(task,workspace,{build:true,test:true,prototype:true});
  assert.equal(passed.approved,true);
  assert.equal(passed.score,100);
  console.log(JSON.stringify({status:"passed",review:"deterministic review gate verified"}));
}finally{
  rmSync(dir,{recursive:true,force:true});
}
