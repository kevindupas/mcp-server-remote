import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
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

// Créer le serveur MCP
const mcpServer = new Server(
    {
        name: 'DQoS MCP Remote Server',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Définir les outils MCP
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'get_locations',
                description: 'Récupère les locations (provinces, districts, etc.) sans polygones géographiques',
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
                inputSchema: {
                    type: 'object',
                    properties: {
                        scope: { type: 'string', enum: ['global', 'operator', 'location', 'network'] },
                        period: { type: 'string', enum: ['last_7_days', 'last_30_days', 'last_3_months'] },
                    },
                },
            },
        ],
    };
});

// Handler pour appeler les outils
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    console.log('Tool called:', { name, args });

    try {
        const endpoint = getEndpointForTool(name);
        const result = await callDqosApi(endpoint, args || {});

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    } catch (error: any) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
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

// ============================================
// ROUTES OAUTH 2.0
// ============================================

// GET /authorize - Page d'autorisation
app.get('/authorize', (req: any, res) => {
    const { client_id, redirect_uri, response_type, state } = req.query;

    if (!client_id || !redirect_uri || response_type !== 'code') {
        return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing or invalid parameters',
        });
    }

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

    const code = generateAuthorizationCode(client_id);
    console.log('Authorization code generated:', { client_id, code: code.substring(0, 10) + '...' });

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
    let client_id = req.body.client_id;
    let client_secret = req.body.client_secret;
    
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

    if (!verifyClientCredentials(client_id, client_secret)) {
        console.error('Invalid credentials');
        return res.status(401).json({
            error: 'invalid_client',
            error_description: 'Invalid client credentials',
        });
    }

    if (!verifyAuthorizationCode(code, client_id)) {
        console.error('Invalid authorization code');
        return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid or expired authorization code',
        });
    }

    const accessToken = generateAccessToken(client_id);
    console.log('Token generated successfully for:', client_id);

    res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400,
    });
});

// ============================================
// ROUTES MCP avec SSE
// ============================================

// POST /mcp/sse - Endpoint SSE pour MCP
app.post('/mcp/sse', async (req, res) => {
    // Vérifier l'authentification
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const verification = verifyAccessToken(token);

    if (!verification.valid) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    console.log('SSE connection established for client:', verification.clientId);

    // Créer le transport SSE
    const transport = new SSEServerTransport('/mcp/sse', res);
    await mcpServer.connect(transport);

    // Le SDK MCP gère automatiquement la communication
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});

app.listen(PORT, () => {
    console.log(`🚀 DQoS MCP Remote Server (SDK) running on port ${PORT}`);
    console.log(`📍 API Base URL: ${API_BASE_URL}`);
    console.log(`🔐 OAuth enabled`);
    console.log(`🌐 Server URL: ${SERVER_URL}`);
});

