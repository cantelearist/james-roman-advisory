"use client";

import { createContext, useContext } from "react";

import type { PortalAccessSummary } from "@/lib/access-control";
import type { AuthUser } from "@/lib/auth";
import type { Capability } from "@/lib/data-model";

type PortalAccessValue = {
  user: AuthUser;
  access: PortalAccessSummary;
  can: (capability: Capability) => boolean;
};

const PortalAccessContext = createContext<PortalAccessValue | null>(null);

export function PortalAccessProvider({
  user,
  access,
  children,
}: {
  user: AuthUser;
  access: PortalAccessSummary;
  children: React.ReactNode;
}) {
  return (
    <PortalAccessContext.Provider
      value={{
        user,
        access,
        can: (capability) =>
          access.role === "super_admin" || access.capabilities.includes(capability),
      }}
    >
      {children}
    </PortalAccessContext.Provider>
  );
}

export function usePortalAccess(): PortalAccessValue {
  const value = useContext(PortalAccessContext);
  if (!value) {
    throw new Error("usePortalAccess must be used inside PortalAccessProvider");
  }
  return value;
}
