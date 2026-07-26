import { getPortalAccessSummary } from "@/lib/access-control";
import { requireAuthContext } from "@/lib/auth";
import { PortalAccessProvider } from "@/components/portal/access-provider";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await requireAuthContext();
  const access = await getPortalAccessSummary(context);

  return (
    <PortalAccessProvider user={context.user} access={access}>
      {children}
    </PortalAccessProvider>
  );
}
