import { SignUp } from "@clerk/nextjs";

import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <SignUp appearance={clerkAppearance} />
    </main>
  );
}
