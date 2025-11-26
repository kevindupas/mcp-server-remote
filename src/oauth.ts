import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Charger le .env AVANT de lire les variables
dotenv.config();

// Stockage en mémoire des tokens (pour production, utiliser Redis ou une DB)
const authorizationCodes = new Map<string, { clientId: string; expiresAt: number }>();
const accessTokens = new Map<string, { clientId: string; expiresAt: number }>();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || 'dqos-mcp-client';
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || 'change-me-in-production';

// Durées de validité
const AUTH_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 heures

/**
 * Génère un code d'autorisation OAuth
 */
export function generateAuthorizationCode(clientId: string): string {
    const code = uuidv4();
    authorizationCodes.set(code, {
        clientId,
        expiresAt: Date.now() + AUTH_CODE_EXPIRY,
    });
    return code;
}

/**
 * Vérifie et consomme un code d'autorisation
 */
export function verifyAuthorizationCode(code: string, clientId: string): boolean {
    const authCode = authorizationCodes.get(code);

    if (!authCode) {
        return false;
    }

    if (authCode.expiresAt < Date.now()) {
        authorizationCodes.delete(code);
        return false;
    }

    if (authCode.clientId !== clientId) {
        return false;
    }

    // Consommer le code (one-time use)
    authorizationCodes.delete(code);
    return true;
}

/**
 * Génère un access token JWT
 */
export function generateAccessToken(clientId: string): string {
    const token = jwt.sign(
        {
            clientId,
            type: 'access_token',
            iat: Math.floor(Date.now() / 1000),
        },
        JWT_SECRET,
        {
            expiresIn: '24h',
        }
    );

    accessTokens.set(token, {
        clientId,
        expiresAt: Date.now() + ACCESS_TOKEN_EXPIRY,
    });

    return token;
}

/**
 * Vérifie un access token
 */
export function verifyAccessToken(token: string): { valid: boolean; clientId?: string } {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        const tokenData = accessTokens.get(token);

        if (!tokenData) {
            return { valid: false };
        }

        if (tokenData.expiresAt < Date.now()) {
            accessTokens.delete(token);
            return { valid: false };
        }

        return {
            valid: true,
            clientId: decoded.clientId,
        };
    } catch (error) {
        return { valid: false };
    }
}

/**
 * Vérifie les credentials du client OAuth
 */
export function verifyClientCredentials(clientId: string, clientSecret: string): boolean {
    console.log('Verifying credentials:');
    console.log('  Expected client_id:', OAUTH_CLIENT_ID);
    console.log('  Received client_id:', clientId);
    console.log('  Match:', clientId === OAUTH_CLIENT_ID);
    console.log('  Expected secret:', OAUTH_CLIENT_SECRET);
    console.log('  Received secret:', clientSecret);
    console.log('  Match:', clientSecret === OAUTH_CLIENT_SECRET);
    
    const isValid = clientId === OAUTH_CLIENT_ID && clientSecret === OAUTH_CLIENT_SECRET;
    console.log('  Overall valid:', isValid);
    
    return isValid;
}

/**
 * Nettoie les tokens expirés (à appeler périodiquement)
 */
export function cleanupExpiredTokens() {
    const now = Date.now();

    // Nettoyer les codes d'autorisation expirés
    for (const [code, data] of authorizationCodes.entries()) {
        if (data.expiresAt < now) {
            authorizationCodes.delete(code);
        }
    }

    // Nettoyer les access tokens expirés
    for (const [token, data] of accessTokens.entries()) {
        if (data.expiresAt < now) {
            accessTokens.delete(token);
        }
    }
}

// Nettoyer les tokens expirés toutes les heures
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

