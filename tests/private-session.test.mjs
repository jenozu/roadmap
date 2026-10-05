import test from "node:test";
import assert from "node:assert/strict";
import {
  createPrivateSessionValue,
  privateSessionConfigured,
  verifyPrivateAccessSecret,
  verifyPrivateSessionValue
} from "../src/lib/private-session.ts";

const env={VOYAGES_PRIVATE_ACCESS_SECRET:"a-very-long-private-voyages-secret-value"};

test("private session uses a signed expiring value without storing the secret", () => {
  const now=Date.UTC(2026,9,5,12,0,0);
  const value=createPrivateSessionValue(now,env);
  assert.ok(value);
  assert.doesNotMatch(value,/a-very-long-private-voyages-secret-value/);
  assert.equal(verifyPrivateSessionValue(value,now+1000,env),true);
  assert.equal(verifyPrivateSessionValue(value,now+13*60*60*1000,env),false);
  assert.equal(verifyPrivateSessionValue(value+"tamper",now+1000,env),false);
});
test("access secret comparison and minimum configuration are controlled", () => {
  assert.equal(privateSessionConfigured(env),true);
  assert.equal(verifyPrivateAccessSecret(env.VOYAGES_PRIVATE_ACCESS_SECRET,env),true);
  assert.equal(verifyPrivateAccessSecret("wrong",env),false);
  assert.equal(privateSessionConfigured({VOYAGES_PRIVATE_ACCESS_SECRET:"short"}),false);
});
