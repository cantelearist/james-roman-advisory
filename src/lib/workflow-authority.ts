import type { UserRole } from "@/lib/data-model";

type AssignedWorkflowRecord = {
  role: UserRole;
  userId: string;
  assigneeUserId?: string | null;
};

export function canCreateWorkflowRecords(role: UserRole): boolean {
  return role !== "contractor" && role !== "client";
}

export function canUpdateWorkflowRecord({
  role,
  userId,
  assigneeUserId,
}: AssignedWorkflowRecord): boolean {
  if (role === "client") return false;
  if (role !== "contractor") return true;
  return Boolean(assigneeUserId) && assigneeUserId === userId;
}

export function isContractorTaskStatusPatch(
  patch: Record<string, unknown>,
): boolean {
  const keys = Object.keys(patch).filter((key) => patch[key] !== undefined);
  return keys.length === 1
    && keys[0] === "status"
    && ["open", "in_progress", "completed"].includes(String(patch.status));
}
