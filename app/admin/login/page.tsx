import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="a-login">
      <div className="a-login__card">
        <p className="a-brand">Pala Trekking</p>
        <h1>Administration</h1>
        <LoginForm />
      </div>
    </main>
  );
}
