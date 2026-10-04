import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import { classifyRisk, requiresApproval } from "./policy.js";
import { research } from "../agents/research.js";

const opportunities=research();
assert.ok(opportunities.length>=3);
assert.ok(opportunities[0].score>=opportunities[1].score);
assert.equal(classifyRisk("delete production database"),"high");
assert.equal(requiresApproval("high"),true);

const temp=mkdtempSync(join(tmpdir(),"v01-control-panel-"));
const port=3500+Math.floor(Math.random()*500);
const tsx=resolve("node_modules","tsx","dist","cli.mjs");
const server=resolve("src","server.ts");
const child=spawn(process.execPath,[tsx,server],{
  cwd:temp,
  env:{...process.env,PORT:String(port),STARTING_CAPITAL_CHF:"100",GITHUB_PUBLISH_ENABLED:"false"},
  stdio:["ignore","pipe","pipe"]
});
let logs="";
child.stdout.on("data",chunk=>{logs+=chunk.toString();});
child.stderr.on("data",chunk=>{logs+=chunk.toString();});
const base="http://127.0.0.1:"+port;
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

try{
  let ready=false;
  for(let i=0;i<40;i++){
    try{const response=await fetch(base+"/api/state"); if(response.ok){ready=true;break;}}catch{}
    await wait(100);
  }
  assert.equal(ready,true,"Control Panel server must start");

  const page=await fetch(base+"/control");
  assert.equal(page.status,200);
  const html=await page.text();
  assert.match(html,/CONTROL PANEL/);
  assert.match(html,/Decision Ledger/);
  assert.match(html,/Pending Approvals/);

  const state=await fetch(base+"/api/state");
  assert.equal(state.status,200);
  const json=await state.json() as {cycle:number;cashChf:number};
  assert.equal(json.cycle,0);
  assert.equal(json.cashChf,100);

  const ledger=await fetch(base+"/api/ledger");
  assert.equal(ledger.status,200);
  assert.deepEqual(await ledger.json(),[]);

  console.log("V0.1 coding-agent + Control Panel smoke validation passed.");
} catch(error) {
  throw new Error(`Control Panel smoke failed: ${error instanceof Error?error.message:String(error)}\n${logs}`);
} finally {
  child.kill("SIGTERM");
  await wait(100);
  rmSync(temp,{recursive:true,force:true});
}
