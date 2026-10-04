import {strict as assert} from "node:assert";
import {mkdtempSync,rmSync,readFileSync,existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Memory} from "./memory.js";
import {createBuildTask} from "../agents/build-task.js";
import {createProductSpecification} from "../agents/product-spec.js";
import {runDeterministicCodeAgent} from "../agents/code-agent.js";
import {research} from "../agents/research.js";

const dir=mkdtempSync(join(tmpdir(),"v01-code-agent-"));
const previous=process.cwd();
try{
  process.chdir(dir);
  const memory=new Memory(100,join(dir,"state.json"));
  const opportunity=research()[0];
  memory.setOpportunities([opportunity]);
  const decision= {
    id:"code-agent-test",cycle:0,action:`Validate and prototype: ${opportunity.title}`,
    reason:"test",expectedOutcome:"Build a useful MVP prototype",confidence:.9,risk:"low" as const,
    approved:true,createdAt:new Date().toISOString(),opportunityId:opportunity.id,
    opportunityScore:opportunity.score,alternatives:[],budgetChf:opportunity.estimatedCostChf,status:"approved" as const
  };
  memory.addDecision(decision);
  const spec=createProductSpecification(memory,decision);
  const task=createBuildTask(decision,memory);
  assert.ok(task.objective.includes("Target customer:"));
  assert.ok(spec.acceptanceCriteria.length>=4);

  const result=await runDeterministicCodeAgent(task);
  assert.equal(result.checks.build,true);
  assert.equal(result.checks.prototype,true);
  assert.equal(result.checks.test,true);
  assert.ok(existsSync(join(result.workspace,"ARCHITECTURE.md")));
  assert.match(readFileSync(join(result.workspace,"README.md"),"utf8"),/Acceptance criteria/);

  console.log(JSON.stringify({status:"passed",mode:result.mode,architecture:true,checks:result.checks}));
}finally{
  process.chdir(previous);
  rmSync(dir,{recursive:true,force:true});
}
