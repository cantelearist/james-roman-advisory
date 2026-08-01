import { describe, expect, it } from "vitest";

import {
  canCreateWorkflowRecords,
  canUpdateWorkflowRecord,
  isContractorTaskStatusPatch,
} from "./workflow-authority";

describe("workflow authority", () => {
  it("keeps workflow definition controls with staff", () => {
    expect(canCreateWorkflowRecords("super_admin")).toBe(true);
    expect(canCreateWorkflowRecords("admin")).toBe(true);
    expect(canCreateWorkflowRecords("contractor")).toBe(false);
    expect(canCreateWorkflowRecords("client")).toBe(false);
  });

  it("allows contractors to update only work assigned to themselves", () => {
    expect(canUpdateWorkflowRecord({
      role: "contractor",
      userId: "contractor-1",
      assigneeUserId: "contractor-1",
    })).toBe(true);
    expect(canUpdateWorkflowRecord({
      role: "contractor",
      userId: "contractor-1",
      assigneeUserId: "contractor-2",
    })).toBe(false);
    expect(canUpdateWorkflowRecord({
      role: "contractor",
      userId: "contractor-1",
      assigneeUserId: null,
    })).toBe(false);
  });

  it("limits contractor task edits to non-cancelling status changes", () => {
    expect(isContractorTaskStatusPatch({ status: "in_progress" })).toBe(true);
    expect(isContractorTaskStatusPatch({ status: "completed" })).toBe(true);
    expect(isContractorTaskStatusPatch({ status: "cancelled" })).toBe(false);
    expect(isContractorTaskStatusPatch({ status: "completed", priority: "urgent" })).toBe(false);
  });
});
