import {strict as assert} from "node:assert";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Memory} from "./memory.js";
import {CeoToolService} from "../agents/ceo-tools.js";

const dir=mkdtempSync(join(tmpdir(),"v01-ceo-tools-"));
const path=join(dir,"state.json");
try{
  const memory=new Memory(100,path);
  const service=new CeoToolService(memory);

  const opportunities=service.researchMarket();
  assert.ok(opportunities.length>=3);

  const analysis=service.analyzeOpportunity(opportunities[0].id);
  assert.equal(analysis.affordable,true);

  const decision=service.createDecision(opportunities[0].id);
  assert.equal(decision.status,"approved");

  const blocked=await service.buildProduct("missing-decision");
  assert.equal(blocked.status,"blocked");

  const gateBlocked=await service.buildProduct(decision.id);\n  assert.equal(gateBlocked.status,"blocked");\n  assert.match(gateBlocked.reason,"Product specification gate failed");\n\n  const spec=service.createProductSpec(decision.id);\n  assert.ok(memory.snapshot().specifications.some(item=>item.decisionId===decision.id));
  assert.equal(spec.pricingChf,opportunities[0].priceChf);
  assert.ok(spec.acceptanceCriteria.length>=4);

  const built=await service.buildProduct(decision.id);
  assert.equal(built.status,"completed");
  assert.equal(built.artifacts?.checks?.build,true);
  assert.equal(built.artifacts?.checks?.prototype,true);

  const tests=service.runTests(decision.id);
  assert.equal(tests.status,"completed");

  const published=service.publish(decision.id);
  assert.equal(published.status,"blocked");

  const measurement=service.measure();
  assert.equal(measurement.completedExecutions,1);

  const pending=service.requestApproval(decision.id);
  assert.equal(pending.requested,false);

  console.log(JSON.stringify({status:"passed",tools:11,execution:built.status}));
}finally{
  rmSync(dir,{recursive:true,force:true});
}
