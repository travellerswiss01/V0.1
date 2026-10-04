import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";

const repoRoot=resolve(".");
const testDir=mkdtempSync(join(tmpdir(),"v01-control-panel-"));
const port=3700+Math.floor(Math.random()*300);
const child=spawn("npx",["tsx",resolve(repoRoot,"src/server.ts")],{
  env:{...process.env,PORT:String(port),STARTING_CAPITAL_CHF:"100",CONTROL_PANEL_TEST_MODE:"true",GITHUB_PUBLISH_ENABLED:"false",COMPANY_STATE_PATH:join(testDir,"company-state.json")},
  cwd:repoRoot,
  stdio:["ignore","pipe","pipe"]
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

  console.log(JSON.stringify({status:"passed",pendingBeforeApproval:true,executedAfterApproval:true},null,2));
} finally {
  child.kill("SIGTERM");
  await wait(100);
  rmSync(testDir,{recursive:true,force:true});
}
