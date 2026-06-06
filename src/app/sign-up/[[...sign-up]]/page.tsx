import { redirect } from "next/navigation";

export default function SignUpPage() {
  redirect("/sign-in?error=Access%20is%20invite-only.");
}
