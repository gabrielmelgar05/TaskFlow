import type { CookieOptions } from 'express';
export const SESSION_COOKIE = 'taskflow_session';
export function sessionCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/' };
}
