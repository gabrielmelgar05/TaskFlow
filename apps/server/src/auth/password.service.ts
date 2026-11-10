import { Injectable, type OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';
@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash!: string;
  async onModuleInit() {
    this.dummyHash = await this.hash(randomBytes(32).toString('hex'));
  }
  hash(password: string) {
    return hash(password, { type: argon2id });
  }
  // Mesmo sem usuário, fazemos a verificação cara para reduzir diferenças de tempo.
  verify(password: string, passwordHash?: string) {
    return verify(passwordHash ?? this.dummyHash, password);
  }
}
