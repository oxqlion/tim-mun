"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import type { Role } from "@/types/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<Role>("warehouse");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [orgName, setOrgName] = useState("");
  const [address, setAddress] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result =
        mode === "login"
          ? await login({ email, password })
          : await register({
              name,
              role,
              email,
              password,
              phone: phone || undefined,
              warehouse: role === "warehouse" ? { name: orgName, address: address || undefined } : undefined,
              logistics: role === "logistics" ? { name: orgName } : undefined,
            });

      router.replace(result.role === "logistics" ? "/logistics/dashboard" : "/warehouse/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-8">
        <h1 className="mb-1 text-xl font-semibold">Agri-logistics</h1>
        <p className="mb-6 text-sm text-black/60">
          {mode === "login" ? "Sign in to your account" : "Create an account"}
        </p>

        <div className="mb-6 flex rounded-md bg-zinc-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded py-1.5 ${mode === "login" ? "bg-white shadow-sm" : "text-black/50"}`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 rounded py-1.5 ${mode === "register" ? "bg-white shadow-sm" : "text-black/50"}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "register" && (
            <>
              <div className="flex rounded-md bg-zinc-100 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setRole("warehouse")}
                  className={`flex-1 rounded py-1.5 ${role === "warehouse" ? "bg-white shadow-sm" : "text-black/50"}`}
                >
                  Warehouse
                </button>
                <button
                  type="button"
                  onClick={() => setRole("logistics")}
                  className={`flex-1 rounded py-1.5 ${role === "logistics" ? "bg-white shadow-sm" : "text-black/50"}`}
                >
                  Logistics
                </button>
              </div>
              <input
                required
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border border-black/15 px-3 py-2 text-sm"
              />
              <input
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-md border border-black/15 px-3 py-2 text-sm"
              />
              <input
                required
                placeholder={role === "warehouse" ? "Warehouse name" : "Company name"}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="rounded-md border border-black/15 px-3 py-2 text-sm"
              />
              {role === "warehouse" && (
                <input
                  placeholder="Address (optional)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="rounded-md border border-black/15 px-3 py-2 text-sm"
                />
              )}
            </>
          )}

          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-sm"
          />
          <input
            required
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-sm"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-black py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
