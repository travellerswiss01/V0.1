import assert from "node:assert/strict";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Memory} from "./memory.js";

const dir=mkdtempSync(join(tmpdir(),"v01-memory-"));
const path=join(dir,"state.json");
try{
  const first=new Memory(100,path);
  assert.equal(first.snapshot().schemaVersion,2);
  assert.equal(first.snapshot().notes.length,0);
  first.setOpportunities([{
    id:"test-opportunity",title:"Test MVP",customer:"Test customer",priceChf:39,mvpDays:1,
    estimatedCostChf:5,competition:"medium",automation:90,score:80,rationale:"Fast validation."
  }]);
  first.addDecision({
    id:"decision-1",cycle:0,action:"Build Test MVP",reason:"Test",expectedOutcome:"Learn",
    confidence:.8,risk:"low",approved:true,createdAt:new Date().toISOString(),
    opportunityId:"test-opportunity",opportunityScore:80,alternatives:[],budgetChf:5,status:"approved"
  });
  const execution=first.addExecution({
    id:"execution-1",decisionId:"decision-1",status:"completed",action:"Build Test MVP",
    startedAt:new Date().toISOString(),completedAt:new Date().toISOString(),costChf:5,revenueChf:39,output:"Built"
  });
  const learning=first.snapshot().notes.find(note=>note.executionId===execution.id);
  assert.ok(learning);
  assert.equal(learning?.opportunityId,"test-opportunity");
  assert.match(learning?.text??"","profit CHF 34.00");
  assert.match(learning?.text??"","ROI 680.0%");
  assert.equal(first.snapshot().notes.filter(note=>note.executionId==="execution-1").length,1);
  const note=first.addNote("learning","Prototype validation is the fastest first test.","system");
  assert.equal(first.searchNotes("validation")[0]?.id,note.id);
  const second=new Memory(999,path);
  const restored=second.snapshot();
  assert.equal(restored.schemaVersion,2);
  assert.equal(restored.cashChf,100);
  assert.equal(restored.notes.length,1);
  assert.equal(restored.notes[0]?.text,"Prototype validation is the fastest first test.");
  assert.ok(restored.updatedAt);
  assert.equal(second.searchNotes("missing").length,0);
  console.log(JSON.stringify({status:"passed",schemaVersion:restored.schemaVersion,persistedNotes:restored.notes.length},null,2));
}finally{rmSync(dir,{recursive:true,force:true});}