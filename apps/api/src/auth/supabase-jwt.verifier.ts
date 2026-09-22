import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { ApiEnvironment } from '../config/environment.js';
import type { VerifiedIdentity } from './auth.types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class SupabaseJwtVerifier {
  private readonly jwks: Parameters<typeof jwtVerify>[1];

  constructor(private readonly environment: ApiEnvironment, keySet?: Parameters<typeof jwtVerify>[1]) {
    this.jwks = keySet ?? createRemoteJWKSet(new URL(environment.supabaseJwksUrl), {
      timeoutDuration: 5000,
    });
  }

  async verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.environment.supabaseJwtIssuer,
        audience: this.environment.supabaseJwtAudience,
        algorithms: ['RS256', 'ES256', 'EdDSA'],
        requiredClaims: ['sub', 'exp'],
      });
      if (typeof payload.sub !== 'string' || !uuidPattern.test(payload.sub) || payload.is_anonymous === true)
        throw new Error('Invalid user identity');
      return { supabaseAuthUserId: payload.sub, email: typeof payload.email === 'string' ? payload.email : null };
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
