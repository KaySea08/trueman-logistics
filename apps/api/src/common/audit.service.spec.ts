import assert from "node:assert/strict";
import test from "node:test";
import { AuditService } from "./audit.service";

const input = {
  action: "TEST",
  targetType: "Test",
  outcome: "SUCCESS" as const,
};

test("audit appends to the actual chain tip after acquiring the transaction lock", async () => {
  const calls: string[] = [];
  let written: { previousHash?: string | null } | undefined;
  const tx = {
    $queryRaw: async () => {
      calls.push(calls.length === 0 ? "lock" : "tip");
      return calls.length === 1 ? [] : [{ eventHash: "actual-tip" }];
    },
    auditEvent: {
      create: async ({ data }: { data: { previousHash?: string | null } }) => {
        calls.push("create");
        written = data;
        return data;
      },
    },
  };
  await new AuditService({} as never).recordInTransaction(tx as never, input);
  assert.deepEqual(calls, ["lock", "tip", "create"]);
  assert.equal(written?.previousHash, "actual-tip");
});

test("audit refuses to append when the history has multiple chain tips", async () => {
  let calls = 0;
  const tx = {
    $queryRaw: async () =>
      ++calls === 1 ? [] : [{ eventHash: "a" }, { eventHash: "b" }],
  };
  await assert.rejects(
    new AuditService({} as never).recordInTransaction(tx as never, input),
    /multiple chain tips/,
  );
});
