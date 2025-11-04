import crypto from 'crypto';

interface JWTPayload {
  email: string;
  userId: string;
  authProvider: string;
  iat: number;
  exp: number;
}

/**
 * Generate a simple JWT-like token for email authentication
 * This is a basic implementation - in production, consider using a library like jsonwebtoken
 */
export function generateToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET || 'default-secret-change-in-production';

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    email,
    userId,
    authProvider: 'email',
    iat: now,
    exp: now + (7 * 24 * 60 * 60) // 7 days
  };

  const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64url');

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = process.env.JWT_SECRET || 'default-secret-change-in-production';
    const parts = token.split('.');

    if (parts.length !== 3) {
      return null;
    }

    const [headerEncoded, payloadEncoded, signature] = parts;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${headerEncoded}.${payloadEncoded}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      console.log('[JWT] Invalid signature');
      return null;
    }

    // Decode payload
    const payloadStr = Buffer.from(payloadEncoded, 'base64url').toString('utf-8');
    const payload: JWTPayload = JSON.parse(payloadStr);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.log('[JWT] Token expired');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('[JWT] Error verifying token:', error);
    return null;
  }
}
