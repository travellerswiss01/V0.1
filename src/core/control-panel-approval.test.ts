import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import process from "node:process";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";

const repoRoot=resolve(".");
const testDir=mkdtempSync(join(tmpdir(),"v01-control-panel-"));
const port=3700+Math.floor(Math.random()*300);
const child=spawn("npx",["tsx",resolve(repoRoot,"src/server.ts")],{
  env:{...process.env,PORT:String(port),STARTING_CAPITAL_CHF:"100",CONTROL_PANEL_TEST_MODE:"true",GITHUB_PUBLISH_ENABLED:"false",COMPANY_STATE_PATH:join(testDir,"company-state.json")},
  cwd:repoRoot,
  stdio:["ignore","pipe","pipe"],
  detached:true
});
let logs="";
child.stdout.on("data",c=>logs+=c.toString());
child.stderr.on("data",c=>logs+=c.toString());
const base="http://127.0.0.1:"+port;
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
try{
  let ready=false;
  for(let i=0;i<50;i++){try{if((await fetch(base+"/api/state")).ok){ready=true;break;}}catch{} await wait(100);}
  assert.ok(ready,logs);

  const create=await fetch(base+"/api/test-risk",{method:"POST"});
  assert.equal(create.status,200);
  const pending=await create.json() as {status:string;decisionId:string};
  assert.equal(pending.status,"pending_approval");

  let state=await (await fetch(base+"/api/state")).json() as any;
  assert.equal(state.pendingApprovals.length,1);
  assert.equal(state.executions.length,0);

  const directBeforeApproval=await fetch(base+"/api/execute",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({decisionId:pending.decisionId})
  });
  assert.equal(directBeforeApproval.status,403,"Execution API must reject unapproved decisions.");
  assert.equal((await directBeforeApproval.json()).error,"Decision is not approved");

  const page=await (await fetch(base+"/control")).text();
  assert.match(page,/Approve & Execute/);

  const approve=await fetch(base+"/approve",{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({decisionId:pending.decisionId}),
    redirect:"manual"
  });
  assert.equal(approve.status,303);

  state=await (await fetch(base+"/api/state")).json() as any;
  assert.equal(state.pendingApprovals.length,0);
  assert.equal(state.executions.length,1);
  if(state.executions[0].status!=="completed") console.error("Control Panel execution error:",state.executions[0].error, state.executions[0].output, logs);
  assert.equal(state.executions[0].status,"completed");
  assert.equal(state.executions[0].decisionId,pending.decisionId);

  const duplicateExecution=await fetch(base+"/api/execute",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({decisionId:pending.decisionId})
  });
  assert.equal(duplicateExecution.status,200,"Approved execution API must remain idempotent.");
  const duplicateResult=await duplicateExecution.json() as any;
  assert.equal(duplicateResult.decisionId,pending.decisionId);
  state=await (await fetch(base+"/api/state")).json() as any;
  assert.equal(state.executions.length,1,"Repeated execution must not create a second execution record.");

  console.log(JSON.stringify({status:"passed",pendingBeforeApproval:true,blockedDirectExecution:true,executedAfterApproval:true,idempotentExecution:true},null,2));
} finally {
  if(child.pid){
    try{process.kill(-child.pid,"SIGTERM");}catch{}
    await wait(500);
    try{process.kill(-child.pid,"SIGKILL");}catch{}
  }else{
    child.kill("SIGTERM");
  }
  rmSync(testDir,{recursive:true,force:true});
}
