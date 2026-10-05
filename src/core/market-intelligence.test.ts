import assert from "node:assert/strict";
import {research} from "../agents/research.js";
import {researchMarket,rankMarketResearch} from "../agents/market-intelligence.js";

const opportunities=research();
const reports=opportunities.map(researchMarket);
assert.equal(reports.length,opportunities.length);
assert.ok(reports.every(r=>r.recommendation==="build"||r.recommendation==="watch"||r.recommendation==="reject"));
assert.ok(reports.every(r=>r.signals.length>=3));
const ranked=rankMarketResearch(reports);
assert.deepEqual(new Set(ranked.map(r=>r.opportunityId)),new Set(reports.map(r=>r.opportunityId)));
console.log("market intelligence tests passed");
