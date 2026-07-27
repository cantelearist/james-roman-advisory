import { getPortalAccessSummary } from "@/lib/access-control";
import { requireAuthContext } from "@/lib/auth";
import { PortalAccessProvider } from "@/components/portal/access-provider";
import { PortalShell } from "@/components/portal/portal-shell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await requireAuthContext();
  const access = await getPortalAccessSummary(context);

  return (
    <PortalAccessProvider user={context.user} access={access}>
      <PortalShell>{children}</PortalShell>
    </PortalAccessProvider>
  );
}
