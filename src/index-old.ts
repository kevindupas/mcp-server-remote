import express from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import axios from 'axios';
import {
    generateAuthorizationCode,
    verifyAuthorizationCode,
    generateAccessToken,
    verifyAccessToken,
    verifyClientCredentials,
} from './oauth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const API_BASE_URL = process.env.DQOS_API_URL || 'http://localhost:8000/api/mcp';
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            formAction: ["'self'", "https://claude.ai", "https://*.claude.ai", "claude://*"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
        },
    },
}));
app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 heures
    },
}));

// Middleware d'authentification OAuth
function oauthMiddleware(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    const verification = verifyAccessToken(token);

    if (!verification.valid) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    req.clientId = verification.clientId;
    next();
}

// Helper pour appeler l'API DQoS
async function callDqosApi(endpoint: string, params: any = {}) {
    try {
        const response = await axios.get(`${API_BASE_URL}/${endpoint}`, {
            params,
            timeout: 30000,
        });
        return response.data;
    } catch (error: any) {
        throw new Error(`API Error: ${error.message}`);
    }
}

// Liste des outils disponibles
const tools = [
    {
        name: 'get_locations',
        description: 'Récupère les locations (provinces, districts, etc.) sans polygones géographiques',
        readOnlyHint: true, // Lecture seule, pas de modification de données
        inputSchema: {
            type: 'object',
            properties: {
                level: {
                    type: 'number',
                    description: 'Niveau hiérarchique: 0=Pays, 1=Province, 2=District',
                },
                search: {
                    type: 'string',
                    description: 'Recherche textuelle',
                },
                with_stats: {
                    type: 'boolean',
                    description: 'Inclure les statistiques',
                },
            },
        },
    },
    {
        name: 'get_kpi_data',
        description: 'Récupère les données KPI de qualité de service',
        readOnlyHint: true,
        inputSchema: {
            type: 'object',
            properties: {
                location_id: { type: 'number' },
                network: { type: 'string', enum: ['2g', '3g', '4g', '5g'] },
                latest_only: { type: 'boolean' },
            },
        },
    },
    {
        name: 'get_scoring',
        description: 'Récupère les scores des opérateurs',
        readOnlyHint: true,
        inputSchema: {
            type: 'object',
            properties: {
                network: { type: 'string', enum: ['2g', '3g', '4g', '5g'] },
                with_rankings: { type: 'boolean' },
            },
        },
    },
    {
        name: 'get_operators',
        description: 'Liste les opérateurs télécoms',
        readOnlyHint: true,
        inputSchema: {
            type: 'object',
            properties: {
                type: { type: 'string', enum: ['mobile', 'fixed', 'isp'] },
                with_stats: { type: 'boolean' },
            },
        },
    },
    {
        name: 'get_coverage',
        description: 'Récupère les statistiques de couverture',
        readOnlyHint: true,
        inputSchema: {
            type: 'object',
            properties: {
                location_id: { type: 'number' },
                network: { type: 'string', enum: ['2g', '3g', '4g', '5g'] },
            },
        },
    },
    {
        name: 'get_analytics',
        description: 'Récupère des analyses globales',
        readOnlyHint: true,
        inputSchema: {
            type: 'object',
            properties: {
                scope: { type: 'string', enum: ['global', 'operator', 'location', 'network'] },
                period: { type: 'string', enum: ['last_7_days', 'last_30_days', 'last_3_months'] },
            },
        },
    },
];

// ============================================
// ROUTES OAUTH 2.0
// ============================================

// GET /authorize - Page d'autorisation (Claude utilise /authorize, pas /oauth/authorize)
app.get('/authorize', (req: any, res) => {
    const { client_id, redirect_uri, response_type, state } = req.query;

    if (!client_id || !redirect_uri || response_type !== 'code') {
        return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing or invalid parameters',
        });
    }

    // Page d'autorisation simple (en production, utiliser une vraie page HTML)
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Autoriser DQoS MCP</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 500px;
                    margin: 100px auto;
                    padding: 20px;
                    text-align: center;
                }
                button {
                    background: #5865F2;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    font-size: 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin: 10px;
                }
                button:hover {
                    background: #4752C4;
                }
                .deny {
                    background: #ED4245;
                }
                .deny:hover {
                    background: #C03537;
                }
            </style>
        </head>
        <body>
            <h1>🔐 Autoriser DQoS MCP</h1>
            <p>Claude souhaite accéder à vos données DQoS.</p>
            <p><strong>Permissions demandées :</strong></p>
            <ul style="text-align: left;">
                <li>Lire les locations</li>
                <li>Lire les données KPI</li>
                <li>Lire les scores opérateurs</li>
                <li>Lire les statistiques de couverture</li>
            </ul>
            <form method="POST" action="/authorize">
                <input type="hidden" name="client_id" value="${client_id}">
                <input type="hidden" name="redirect_uri" value="${redirect_uri}">
                <input type="hidden" name="state" value="${state || ''}">
                <button type="submit" name="action" value="allow">✅ Autoriser</button>
                <button type="submit" name="action" value="deny" class="deny">❌ Refuser</button>
            </form>
        </body>
        </html>
    `);
});

// POST /authorize - Traiter l'autorisation
app.post('/authorize', (req, res) => {
    const { client_id, redirect_uri, state, action } = req.body;

    console.log('Authorization request:', { client_id, redirect_uri, state, action });

    if (action !== 'allow') {
        console.log('Authorization denied by user');
        return res.redirect(`${redirect_uri}?error=access_denied&state=${state || ''}`);
    }

    // Générer le code d'autorisation
    const code = generateAuthorizationCode(client_id);
    console.log('Authorization code generated:', { client_id, code: code.substring(0, 10) + '...' });

    // Rediriger vers Claude avec le code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) {
        redirectUrl.searchParams.set('state', state);
    }

    console.log('Redirecting to:', redirectUrl.toString());
    res.redirect(redirectUrl.toString());
});

// POST /token - Échanger le code contre un access token
app.post('/token', (req, res) => {
    // Claude peut envoyer les credentials dans le body OU dans le header Authorization
    let client_id = req.body.client_id;
    let client_secret = req.body.client_secret;

    // Si pas dans le body, vérifier le header Authorization (Basic Auth)
    if (!client_id || !client_secret) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Basic ')) {
            const base64Credentials = authHeader.substring(6);
            const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
            const [id, secret] = credentials.split(':');
            client_id = id;
            client_secret = secret;
        }
    }

    const { grant_type, code, redirect_uri } = req.body;

    console.log('Token request:', { grant_type, code, client_id, has_secret: !!client_secret });

    if (grant_type !== 'authorization_code') {
        return res.status(400).json({
            error: 'unsupported_grant_type',
            error_description: 'Only authorization_code grant type is supported',
        });
    }

    if (!code || !client_id || !client_secret) {
        console.error('Missing parameters:', { code: !!code, client_id: !!client_id, client_secret: !!client_secret });
        return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing required parameters',
        });
    }

    // Vérifier les credentials du client
    if (!verifyClientCredentials(client_id, client_secret)) {
        console.error('Invalid credentials:', { client_id, provided_secret: client_secret.substring(0, 10) + '...' });
        return res.status(401).json({
            error: 'invalid_client',
            error_description: 'Invalid client credentials',
        });
    }

    // Vérifier et consommer le code d'autorisation
    if (!verifyAuthorizationCode(code, client_id)) {
        console.error('Invalid authorization code:', { code, client_id });
        return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid or expired authorization code',
        });
    }

    // Générer l'access token
    const accessToken = generateAccessToken(client_id);

    console.log('Token generated successfully for:', client_id);

    res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400, // 24 heures
    });
});

// ============================================
// ROUTES MCP
// ============================================

// GET /mcp - Informations sur le serveur MCP (avec liste des outils)
app.get('/mcp', (req, res) => {
    res.json({
        name: 'DQoS MCP Remote Server',
        version: '1.0.0',
        protocol: 'mcp-remote',
        capabilities: {
            tools: true,
        },
        oauth: {
            authorization_endpoint: `${SERVER_URL}/authorize`,
            token_endpoint: `${SERVER_URL}/token`,
        },
        tools, // Ajouter la liste des outils ici pour que Claude les voie
    });
});

// GET /mcp/tools - Liste des outils
app.get('/mcp/tools', oauthMiddleware, (req, res) => {
    res.json({
        tools,
    });
});

// POST /mcp/call-tool - Appeler un outil
app.post('/mcp/call-tool', oauthMiddleware, async (req, res) => {
    const { name, arguments: args } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Tool name is required' });
    }

    try {
        let result: any;
        const endpoint = getEndpointForTool(name);

        result = await callDqosApi(endpoint, args || {});

        res.json({
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                },
            ],
        });
    } catch (error: any) {
        res.status(500).json({
            error: error.message,
        });
    }
});

// POST /mcp/sse - Server-Sent Events pour le streaming (optionnel)
app.post('/mcp/sse', oauthMiddleware, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const { name, arguments: args } = req.body;

    try {
        const endpoint = getEndpointForTool(name);
        const result = await callDqosApi(endpoint, args || {});

        res.write(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`);
        res.end();
    } catch (error: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});

function getEndpointForTool(toolName: string): string {
    const mapping: Record<string, string> = {
        'get_locations': 'locations',
        'get_kpi_data': 'kpi-data',
        'get_scoring': 'scoring',
        'get_operators': 'operators',
        'get_coverage': 'coverage',
        'get_analytics': 'analytics',
    };
    return mapping[toolName] || toolName;
}

app.listen(PORT, () => {
    console.log(`🚀 DQoS MCP Remote Server running on port ${PORT}`);
    console.log(`📍 API Base URL: ${API_BASE_URL}`);
    console.log(`🔐 OAuth enabled`);
    console.log(`🌐 Server URL: ${SERVER_URL}`);
});
