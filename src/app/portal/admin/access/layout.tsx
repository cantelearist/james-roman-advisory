import { requireSuperAdmin } from "@/lib/auth";

export default async function AccessManagementLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireSuperAdmin();
  return children;
}
