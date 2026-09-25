"use client";

import { createContext, createElement, useContext } from "react";

const UserIdContext = createContext<string | null>(null);

/**
 * Supplies the signed-in user's id to the client.
 *
 * The (app) layout already validates the session on the server before it
 * renders anything, so it passes the id down rather than making the browser
 * ask /api/auth/get-session for it again — a round trip every data query used
 * to wait behind.
 */
export function UserIdProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  return createElement(UserIdContext.Provider, { value: userId }, children);
}

/**
 * The signed-in user's id. Every data query keys its cache on it, so one
 * account's cached data is never shown to another.
 *
 * @returns The user id, or null outside the authenticated app shell.
 */
export function useUserId(): string | null {
  return useContext(UserIdContext);
}
