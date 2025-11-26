# 🌐 DQoS MCP Remote Server

Serveur MCP accessible via HTTP/SSE pour Claude Desktop et autres clients IA.

## 🎯 Différence avec mcp-server

| Aspect | mcp-server (local) | mcp-server-remote (HTTP) |
|--------|-------------------|--------------------------|
| **Communication** | stdio (stdin/stdout) | HTTP/SSE |
| **Déploiement** | Machine locale | Serveur distant |
| **Configuration Claude** | Fichier JSON local | URL dans l'interface |
| **Sécurité** | Pas besoin | Token Bearer requis |
| **Usage** | Développement perso | Partage avec équipe |

## 🚀 Installation

```bash
cd mcp-server-remote
npm install
```

## ⚙️ Configuration

```bash
cp .env.example .env
```

Éditer `.env` :

```env
PORT=4000
DQOS_API_URL=https://dqos-mz.com/api/mcp
MCP_SECRET=ton-secret-super-securise-ici
```

## 🏃 Démarrage

### Développement

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## 🌐 Déployer sur un serveur

### Option 1 : Railway

```bash
railway up
railway variables set MCP_SECRET=ton-secret
railway variables set DQOS_API_URL=https://dqos-mz.com/api/mcp
```

### Option 2 : Render

1. Connecter le repo
2. Build: `npm install && npm run build`
3. Start: `npm start`
4. Variables d'env

### Option 3 : VPS (Ubuntu)

```bash
# Sur le serveur
git clone votre-repo
cd mcp-server-remote
npm install
npm run build

# PM2 pour garder le serveur actif
npm install -g pm2
pm2 start dist/index.js --name mcp-server-remote
pm2 save
pm2 startup
```

### Option 4 : Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["npm", "start"]
```

```bash
docker build -t mcp-server-remote .
docker run -p 4000:4000 --env-file .env mcp-server-remote
```

## 🔧 Configuration dans Claude Desktop

### Étape 1 : Déployer le serveur

Ton serveur MCP Remote doit être accessible publiquement :
```
https://mcp.votre-domaine.com
```

### Étape 2 : Dans Claude Desktop

1. Ouvrir Claude Desktop
2. Aller dans **Settings**
3. Cliquer sur **"Ajouter un connecteur personnalisé"** (BETA)
4. Remplir :
   - **Nom :** DQoS Mozambique
   - **URL :** `https://mcp.votre-domaine.com/mcp`
   - **Token :** `Bearer ton-secret-super-securise-ici`

### Étape 3 : Tester

Poser une question à Claude :
```
"Quels sont les opérateurs disponibles au Mozambique ?"
```

Claude devrait utiliser automatiquement ton serveur MCP Remote ! 🎉

## 🔐 Sécurité

### 1. Token Bearer

Toutes les requêtes doivent inclure :
```
Authorization: Bearer ton-secret-super-securise-ici
```

### 2. HTTPS obligatoire

En production, utilise **toujours HTTPS** :
```bash
# Avec Caddy (auto HTTPS)
caddy reverse-proxy --from mcp.votre-domaine.com --to localhost:4000

# Ou Nginx + Let's Encrypt
```

### 3. Rate limiting (optionnel)

Ajoute un rate limiter si besoin :
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60000,
  max: 100,
});

app.use('/mcp', limiter);
```

## 📡 Endpoints

### GET /mcp
Infos sur le serveur

### GET /mcp/tools
Liste des outils disponibles

**Headers:**
```
Authorization: Bearer ton-secret
```

**Response:**
```json
{
  "tools": [
    {
      "name": "get_locations",
      "description": "...",
      "inputSchema": {...}
    }
  ]
}
```

### POST /mcp/call-tool
Appeler un outil

**Headers:**
```
Authorization: Bearer ton-secret
Content-Type: application/json
```

**Body:**
```json
{
  "name": "get_locations",
  "arguments": {
    "level": 1,
    "with_stats": true
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{...données...}"
    }
  ]
}
```

## 🧪 Test avec curl

```bash
# Liste des outils
curl https://mcp.votre-domaine.com/mcp/tools \
  -H "Authorization: Bearer ton-secret"

# Appeler un outil
curl -X POST https://mcp.votre-domaine.com/mcp/call-tool \
  -H "Authorization: Bearer ton-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_operators",
    "arguments": {
      "type": "mobile",
      "with_stats": true
    }
  }'
```

## 🎉 Avantages du MCP Remote

✅ **Accessible depuis n'importe où** (pas besoin d'install locale)  
✅ **Partageable avec ton équipe** (même URL pour tous)  
✅ **Centralisé** (un seul serveur pour tout le monde)  
✅ **Facile à configurer dans Claude** (juste une URL)  
✅ **Ferme le clapet des collègues** 😎  

## 🔄 Multi-instances

Pour gérer plusieurs pays, tu peux :

### Option 1 : Plusieurs serveurs

```
https://mcp-mz.votre-domaine.com  → Mozambique
https://mcp-zm.votre-domaine.com  → Zambie
https://mcp-zw.votre-domaine.com  → Zimbabwe
```

### Option 2 : Un serveur avec paramètre

Modifier le serveur pour accepter un paramètre `country` :

```typescript
app.post('/mcp/call-tool', authMiddleware, async (req, res) => {
  const { name, arguments: args, country } = req.body;
  const apiUrl = getApiUrlForCountry(country);
  // ...
});
```

Configuration Claude :
```
Nom: DQoS Mozambique
URL: https://mcp.votre-domaine.com/mcp?country=mz
```

---

**Version:** 1.0.0  
**Date:** 25 Novembre 2024  
**Pour Claude Desktop BETA** 🚀

