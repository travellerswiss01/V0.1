import {strict as assert} from "node:assert";
import {mkdtempSync,rmSync} from "node:fs";
import {join} from "node:path";
import {Memory} from "./memory.js";

const dir=mkdtempSync(join("/tmp","v01-control-room-"));
try{
  const memory=new Memory(100,join(dir,"state.json"));
  const state=memory.snapshot();
  assert.equal(state.cycle,0);
  assert.equal(state.cashChf,100);
  console.log(JSON.stringify({status:"passed",controlRoom:"pipeline state compatible"}));
}finally{
  rmSync(dir,{recursive:true,force:true});
}
