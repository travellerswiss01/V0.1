import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {ExecutionLock,withExecutionLock} from "./execution-lock.js";

const dir=mkdtempSync(join(tmpdir(),"v01-lock-"));
const path=join(dir,"execution.lock");
const first=new ExecutionLock(path);
const second=new ExecutionLock(path);

try{
  assert.equal(first.acquire("first"),true);
  assert.equal(second.acquire("second"),false);
  assert.equal(second.status().locked,true);
  first.release();
  assert.equal(second.acquire("second"),true);
  let released=false;
  await withExecutionLock(second,"second",async()=>{
    released=true;
    assert.equal(second.status().locked,true);
  });
  assert.equal(released,true);
  assert.equal(second.status().locked,false);
  console.log(JSON.stringify({status:"passed",concurrentExecutionBlocked:true},null,2));
}finally{
  first.release();
  second.release();
  rmSync(dir,{recursive:true,force:true});
}