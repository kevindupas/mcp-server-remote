import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { 
    CallToolRequestSchema, 
    ListToolsRequestSchema,
    Tool 
} from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response } from 'express';
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

// Définition des outils
const tools: Tool[] = [
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
];

// Fonction pour créer un serveur MCP pour chaque connexion
function createMCPServer() {
    const server = new Server(
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

    // Handler pour lister les outils
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        console.log('📋 Listing tools');
        return { tools };
    });

    // Handler pour appeler les outils
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        console.log('🔧 Tool called:', { name, args });

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
            console.error('❌ Tool error:', error);
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

    return server;
}

// ============================================
// ROUTES OAUTH 2.0
// ============================================

app.get('/authorize', (req: Request, res: Response) => {
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

app.post('/authorize', (req: Request, res: Response) => {
    const { client_id, redirect_uri, state, action } = req.body;

    console.log('🔐 Authorization request:', { client_id, redirect_uri, state, action });

    if (action !== 'allow') {
        console.log('❌ Authorization denied');
        return res.redirect(`${redirect_uri}?error=access_denied&state=${state || ''}`);
    }

    const code = generateAuthorizationCode(client_id);
    console.log('✅ Authorization code generated');

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) {
        redirectUrl.searchParams.set('state', state);
    }

    res.redirect(redirectUrl.toString());
});

app.post('/token', (req: Request, res: Response) => {
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
    
    const { grant_type, code } = req.body;

    console.log('🎫 Token request:', { grant_type, client_id });

    if (grant_type !== 'authorization_code') {
        return res.status(400).json({
            error: 'unsupported_grant_type',
            error_description: 'Only authorization_code grant type is supported',
        });
    }

    if (!code || !client_id || !client_secret) {
        return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing required parameters',
        });
    }

    if (!verifyClientCredentials(client_id, client_secret)) {
        return res.status(401).json({
            error: 'invalid_client',
            error_description: 'Invalid client credentials',
        });
    }

    if (!verifyAuthorizationCode(code, client_id)) {
        return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid or expired authorization code',
        });
    }

    const accessToken = generateAccessToken(client_id);
    console.log('✅ Token generated successfully');

    res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400,
    });
});

// ============================================
// ENDPOINT SSE MCP
// ============================================

app.get('/sse', async (req: Request, res: Response) => {
    console.log('🔌 SSE connection attempt');
    
    // Vérifier l'authentification
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('❌ No auth header');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const verification = verifyAccessToken(token);

    if (!verification.valid) {
        console.log('❌ Invalid token');
        return res.status(401).json({ error: 'Invalid token' });
    }

    console.log('✅ SSE connection authenticated for:', verification.clientId);

    // Créer un nouveau serveur MCP pour cette connexion
    const mcpServer = createMCPServer();

    // Créer le transport SSE
    const transport = new SSEServerTransport('/sse', res);
    
    // Connecter le serveur MCP au transport
    await mcpServer.connect(transport);
    
    console.log('🚀 MCP Server connected via SSE');

    // Gérer la fermeture de la connexion
    req.on('close', () => {
        console.log('🔌 SSE connection closed');
    });
});

// Health check
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});

app.listen(PORT, () => {
    console.log('🚀 DQoS MCP Remote Server (SSE) running on port', PORT);
    console.log('📍 API Base URL:', API_BASE_URL);
    console.log('🔐 OAuth enabled');
    console.log('🌐 Server URL:', SERVER_URL);
    console.log('📡 SSE endpoint: /sse');
});

