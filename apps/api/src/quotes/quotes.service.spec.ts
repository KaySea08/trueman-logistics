import assert from "node:assert/strict";
import test from "node:test";

import { QuotesService } from "./quotes.service";

const input = {
  mode: "AIR" as const,
  destinationCountryCode: "GH",
  destinationCity: "Accra",
  destinationAddressLine: "12 Independence Avenue",
  recipientName: "Ama Mensah",
  recipientPhone: "+233201234567",
  senderName: "Li Wei",
  senderPhone: "+8613812345678",
  chinaCollectionAddress: "88 Freight Road, Shenzhen",
  packages: [
    {
      description: "Textiles",
      quantity: 2,
      weightKg: 4.5,
      lengthCm: 40,
      widthCm: 30,
      heightCm: 20,
    },
  ],
};

function createService(prisma: unknown) {
  return new QuotesService(
    prisma as never,
    {} as never,
    { eval: async () => 1 } as never,
  );
}

test("customer intake persists a request and outbox event without rate lookup", async () => {
  const writes: string[] = [];
  const request = {
    findUnique: async () => null,
    create: async ({ data }: { data: { requestNumber: string } }) => {
      writes.push(`request:${data.requestNumber}`);
      return {
        id: "request-1",
        requestNumber: data.requestNumber,
        status: "REQUESTED",
        createdAt: new Date("2026-11-14T10:00:00.000Z"),
      };
    },
  };
  const outbox = {
    create: async ({ data }: { data: { eventKey: string } }) => {
      writes.push(`outbox:${data.eventKey}`);
      return { id: "event-1" };
    },
  };
  const history = {
    create: async () => ({ id: "history-1" }),
  };
  const tx = {
    quoteRequest: request,
    quoteOutboxEvent: outbox,
    quoteRequestHistory: history,
  };
  const prisma = {
    customer: { findUnique: async () => ({ id: "customer-1" }) },
    quoteRequest: request,
    $transaction: async (work: (client: typeof tx) => Promise<unknown>) =>
      work(tx),
    rateRule: {
      findMany: async () => {
        throw new Error("Customer intake must not calculate prices.");
      },
    },
  };

  const response = await createService(prisma).create(
    "user-1",
    input,
    "request-key-1",
    "127.0.0.1",
  );

  assert.equal(response.status, "REQUESTED");
  assert.equal(response.requestNumber.startsWith("TRQR-"), true);
  assert.match(response.message, /calculate and send/i);
  assert.equal(writes.length, 2);
  assert.match(writes[1], /^outbox:quote-request-received:/);
});

test("the same idempotency key and payload returns the original request", async () => {
  const requestSnapshot = {
    originCountryCode: "CN",
    chinaCollectionAddress: input.chinaCollectionAddress,
    senderName: input.senderName,
    senderPhone: input.senderPhone,
    recipientName: input.recipientName,
    recipientPhone: input.recipientPhone,
    destinationCountryCode: input.destinationCountryCode,
    destinationCity: input.destinationCity,
    destinationAddressLine: input.destinationAddressLine,
    handlingInstructions: null,
    packages: input.packages,
  };
  let createCalls = 0;
  const prisma = {
    customer: { findUnique: async () => ({ id: "customer-1" }) },
    quoteRequest: {
      findUnique: async () => ({
        id: "request-existing",
        requestNumber: "TRQR-2026-EXISTING",
        status: "REQUESTED",
        createdAt: new Date("2026-11-14T09:00:00.000Z"),
        requestSnapshot,
      }),
      create: async () => {
        createCalls += 1;
        throw new Error("Duplicate request should not be created.");
      },
    },
    $transaction: async () => {
      throw new Error(
        "Duplicate request should not start a write transaction.",
      );
    },
  };

  const response = await createService(prisma).create(
    "user-1",
    input,
    "request-key-replay",
    "127.0.0.1",
  );

  assert.equal(response.id, "request-existing");
  assert.equal(response.requestNumber, "TRQR-2026-EXISTING");
  assert.equal(createCalls, 0);
});

test("admin search filters remain active when loading the next cursor page", async () => {
  let where: Record<string, unknown> | undefined;
  const prisma = {
    quoteRequest: {
      findMany: async ({
        where: filters,
      }: {
        where: Record<string, unknown>;
      }) => {
        where = filters;
        return [];
      },
    },
  };
  const cursorDate = "2026-11-14T10:00:00.000Z";
  const cursor = Buffer.from(`${cursorDate}|request-0`).toString("base64url");

  await createService(prisma).listAdminQuoteRequests(
    {
      limit: 50,
      search: "TRQR-2026",
      cursor,
      sort: "newest",
    } as never,
    "manager-1",
    true,
  );

  const filterGroups = where?.AND as Array<{
    OR: Array<Record<string, unknown>>;
  }>;
  assert.equal(filterGroups.length, 2);
  assert.deepEqual(filterGroups[0].OR[0], {
    requestNumber: { contains: "TRQR-2026", mode: "insensitive" },
  });
  assert.deepEqual(filterGroups[1].OR[0], {
    createdAt: { lt: new Date(cursorDate) },
  });
});

test("quote officers only list requests assigned to their staff profile", async () => {
  let where: Record<string, unknown> | undefined;
  const prisma = {
    staffProfile: {
      findFirst: async () => ({ id: "staff-1" }),
    },
    quoteRequest: {
      findMany: async ({
        where: filters,
      }: {
        where: Record<string, unknown>;
      }) => {
        where = filters;
        return [];
      },
    },
  };

  await createService(prisma).listAdminQuoteRequests(
    { limit: 50, sort: "newest" } as never,
    "officer-1",
    false,
  );

  assert.equal(where?.assignedToStaffId, "staff-1");
});

test("quote officers cannot open requests assigned to another staff member", async () => {
  let where: Record<string, unknown> | undefined;
  const prisma = {
    staffProfile: {
      findFirst: async () => ({ id: "staff-1" }),
    },
    quoteRequest: {
      findFirst: async ({
        where: filters,
      }: {
        where: Record<string, unknown>;
      }) => {
        where = filters;
        return null;
      },
    },
  };

  await assert.rejects(
    createService(prisma).getAdminQuoteRequest("request-2", "officer-1", false),
    /Quote request not found/,
  );
  assert.deepEqual(where, { id: "request-2", assignedToStaffId: "staff-1" });
});
