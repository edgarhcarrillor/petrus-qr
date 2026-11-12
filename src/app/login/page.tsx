import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-sm p-8">
        <Brand className="mb-8" />
        <h1 className="mb-6 text-xl font-semibold">Panel de administración</h1>
        <LoginForm />
      </div>
    </main>
  );
}
