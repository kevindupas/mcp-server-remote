import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const API_BASE_URL = process.env.DQOS_API_URL || 'http://localhost:8000/api/mcp';
const MCP_SECRET = process.env.MCP_SECRET || 'change-me-in-production';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Middleware d'authentification simple
function authMiddleware(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;

    if (!authHeader || authHeader !== `Bearer ${MCP_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

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

// GET /mcp - Informations sur le serveur MCP
app.get('/mcp', (req, res) => {
    res.json({
        name: 'DQoS MCP Remote Server',
        version: '1.0.0',
        protocol: 'mcp-remote',
        capabilities: {
            tools: true,
        },
    });
});

// GET /mcp/tools - Liste des outils
app.get('/mcp/tools', authMiddleware, (req, res) => {
    res.json({
        tools,
    });
});

// POST /mcp/call-tool - Appeler un outil
app.post('/mcp/call-tool', authMiddleware, async (req, res) => {
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
app.post('/mcp/sse', authMiddleware, async (req, res) => {
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
    console.log(`🔐 Auth: Bearer ${MCP_SECRET.substring(0, 10)}...`);
});

