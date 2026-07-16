"use client";

import { api } from "./api";
import type { LoginPayload, RegisterPayload, Role, TokenResponse } from "@/types/api";

const TOKEN_KEY = "access_token";
const ROLE_KEY = "role";

function persistSession(token: TokenResponse) {
  window.localStorage.setItem(TOKEN_KEY, token.access_token);
  window.localStorage.setItem(ROLE_KEY, token.role);
}

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  const token = await api.post<TokenResponse>("/auth/login", payload);
  persistSession(token);
  return token;
}

export async function register(payload: RegisterPayload): Promise<TokenResponse> {
  const token = await api.post<TokenResponse>("/auth/register", payload);
  persistSession(token);
  return token;
}

export function logout() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ROLE_KEY);
}

export function getRole(): Role | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ROLE_KEY) as Role | null;
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(TOKEN_KEY));
}
