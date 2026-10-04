import {strict as assert} from "node:assert";
import {mkdtempSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {Memory} from "./memory.js";
import {runCeoDecisionLoop} from "../agents/ceo-loop.js";

const dir=mkdtempSync(join(tmpdir(),"v01-ceo-loop-"));
try{
  const memory=new Memory(100,join(dir,"state.json"));
  const result=await runCeoDecisionLoop(memory);
  const state=memory.snapshot();

  assert.equal(result.mode,"deterministic","Test environment must use safe deterministic fallback without API key.");
  assert.equal(result.critic,"skipped");
  assert.equal(result.decision.status,"approved");
  assert.equal(state.cycle,1);
  assert.equal(state.decisions.length,1);
  assert.equal(state.executions.length,1);
  assert.equal(state.executions[0].status,"completed");
  assert.ok(state.notes.some(note=>note.category==="learning"));

  console.log(JSON.stringify({
    status:"passed",
    mode:result.mode,
    decision:result.decision.status,
    execution:state.executions[0].status,
    learningNotes:state.notes.length
  }));
}finally{
  rmSync(dir,{recursive:true,force:true});
}
