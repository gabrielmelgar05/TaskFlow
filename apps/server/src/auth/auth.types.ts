import type { Request } from 'express';
export interface PublicUser {
  id: string;
  name: string;
  email: string;
}
export interface AuthenticatedRequest extends Request {
  auth: { user: PublicUser; sessionId: string };
}
export const publicUserSelect = { id: true, name: true, email: true } as const;
