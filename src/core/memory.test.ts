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