import assert from "node:assert/strict";
import {classifyFailure,nextRetry} from "./failure.js";

const cases=[
  ["payment","payment rejected",false],
  ["legal","contract review required",false],
  ["destructive","delete operation blocked",false],
  ["policy","operation not allowed",false],
  ["permission","403 forbidden",false],
  ["auth","API key missing",false],
  ["budget","insufficient cash",false],
  ["approval","decision not approved",false],
  ["transient","network timeout",true],
  ["validation","TypeScript compile failed",true],
  ["unknown","unexpected condition",false]
] as const;

for(const [expected,message,retryable] of cases){
  const result=classifyFailure(new Error(message));
  assert.equal(result.code,expected);
  assert.equal(result.retryable,retryable);
}

assert.equal(nextRetry(1,3,classifyFailure(new Error("network timeout"))).retry,true);
assert.equal(nextRetry(3,3,classifyFailure(new Error("network timeout"))).retry,false);
assert.equal(nextRetry(1,3,classifyFailure(new Error("payment rejected"))).retry,false);

console.log("failure classification and bounded retry tests passed");
