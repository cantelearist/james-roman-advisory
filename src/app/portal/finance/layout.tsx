import { redirect } from "next/navigation";

import { getPortalAccessSummary, hasCapability } from "@/lib/access-control";
import { requireAuthContext } from "@/lib/auth";

export default async function FinanceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await requireAuthContext();
  const access = await getPortalAccessSummary(context);
  if (!hasCapability(access, "finance.view")) {
    redirect("/portal");
  }
  return children;
}
