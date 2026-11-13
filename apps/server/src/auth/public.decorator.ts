import { SetMetadata } from '@nestjs/common';
export const PUBLIC_ROUTE = 'auth:public';
export interface PublicOptions {
  allowDirect?: boolean;
}
export const Public = (options: PublicOptions = {}) =>
  SetMetadata(PUBLIC_ROUTE, options);
