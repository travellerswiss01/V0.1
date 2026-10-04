import assert from "node:assert/strict";
import { classifyRisk, requiresApproval } from "./policy.js";
import { research } from "../agents/research.js";

const opportunities=research();
assert.ok(opportunities.length>=3);
assert.ok(opportunities[0].score>=opportunities[1].score);
assert.equal(classifyRisk("delete production database"),"high");
assert.equal(requiresApproval("high"),true);
console.log("V0.1 coding-agent smoke validation passed.");