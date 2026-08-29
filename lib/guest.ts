import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Guest identity (PRD §10). The browser only ever holds an opaque token in an
 * httpOnly cookie; the database stores its sha256 hash. Nicknames are display
 * only and never establish identity.
 */

const COOKIE_MAX_AGE = 60 * 60 * 12; // matches the room's 12-hour lifetime

function cookieName(roomCode: string) {
  return `spot_room_${roomCode.toLowerCase()}`;
}

export function newGuestToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function readGuestToken(roomCode: string): Promise<string | null> {
  const store = await cookies();
  return store.get(cookieName(roomCode))?.value ?? null;
}

export async function writeGuestToken(roomCode: string, token: string) {
  const store = await cookies();
  store.set(cookieName(roomCode), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}
