import { redirect } from "next/navigation";

export default function LegacyResetPasswordPage() {
  redirect("/auth/reset-password");
}
