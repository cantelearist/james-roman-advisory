import { redirect } from "next/navigation";

import { getPortalAccessSummary, hasCapability } from "@/lib/access-control";
import { requireAuthContext } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await requireAuthContext();
  const access = await getPortalAccessSummary(context);
  if (!hasCapability(access, "users.invite") && !hasCapability(access, "access.manage")) {
    redirect("/portal");
  }
  return children;
}
