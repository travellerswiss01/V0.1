import assert from "node:assert/strict";
import { Memory } from "./memory.js";
import { runCeoCycle } from "../agents/ceo.js";

const memory = new Memory(100);
const decision = await runCeoCycle(memory);
const state = memory.snapshot();
const execution = state.executions.find(item => item.decisionId === decision.id);

assert.ok(execution, "CEO cycle must create an execution result");
assert.equal(execution?.status, "completed", "E2E execution must complete");
assert.ok(execution?.artifacts?.workspace, "Execution must expose the product workspace");
assert.equal(execution?.artifacts?.checks?.build, true, "Repository build must pass");
assert.equal(execution?.artifacts?.checks?.test, true, "Smoke test must pass");
assert.equal(execution?.artifacts?.checks?.prototype, true, "Prototype TypeScript validation must pass");

if (process.env.GITHUB_PUBLISH_ENABLED === "true") {
  assert.ok(execution?.artifacts?.github?.branch, "Live E2E must publish a GitHub branch");
  assert.ok(execution?.artifacts?.github?.commitSha, "Live E2E must create a commit");
  assert.ok(execution?.artifacts?.github?.prNumber, "Live E2E must create a draft PR");
  assert.ok(execution?.artifacts?.github?.prUrl, "Live E2E must return the PR URL");
}

console.log(JSON.stringify({
  status:"passed",
  cycle:state.cycle,
  decisionId:decision.id,
  mode:execution?.artifacts?.mode,
  workspace:execution?.artifacts?.workspace,
  github:execution?.artifacts?.github ?? null
},null,2));
