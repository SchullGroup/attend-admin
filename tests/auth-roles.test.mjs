import assert from "node:assert/strict";
import test from "node:test";

import {
  getAuthRoles,
  hasAttendAdminRole,
  normalizeAuthRole,
} from "../src/lib/auth-roles.ts";

test("normalizes backend role variants", () => {
  assert.equal(normalizeAuthRole(" SUPER-ADMIN "), "super_admin");
  assert.equal(normalizeAuthRole("Client Admin"), "client_admin");
});

test("allows the established Attend Admin roles", () => {
  const allowedRoles = [
    "SUPER_ADMIN",
    "SUPERADMIN",
    "CLIENT_ADMIN",
    "ADMIN",
    "EVENT_MANAGER",
    "KYC_OFFICER",
    "VIEWER",
    "JUDGE",
  ];

  for (const role of allowedRoles) {
    assert.equal(hasAttendAdminRole({ role }), true, role);
  }
});

test("supports the auth service response shapes", () => {
  assert.deepEqual(getAuthRoles({ roles: ["ATTENDEE", "VIEWER"] }), [
    "attendee",
    "viewer",
  ]);
  assert.equal(hasAttendAdminRole({ user: { role: "CLIENT_ADMIN" } }), true);
  assert.equal(hasAttendAdminRole({ account: { roles: ["JUDGE"] } }), true);
});

test("fails closed for attendee and unknown accounts", () => {
  const rejectedPayloads = [
    undefined,
    {},
    { role: "ATTENDEE" },
    { roles: ["ATTENDEE", "REGISTRANT"] },
    { user: { role: "PARTICIPANT" } },
    { role: "NEW_UNREVIEWED_ROLE" },
  ];

  for (const payload of rejectedPayloads) {
    assert.equal(hasAttendAdminRole(payload), false, JSON.stringify(payload));
  }
});