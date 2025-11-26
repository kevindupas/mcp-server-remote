# 🔐 Configuration OAuth pour Claude

## 📋 Ce qui a changé

Le serveur MCP Remote utilise maintenant **OAuth 2.0** pour l'authentification, comme requis par Claude.

## 🚀 Déploiement avec OAuth

### 1. Génère les secrets

```bash
# Sur le serveur
OAUTH_CLIENT_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)

echo "OAUTH_CLIENT_SECRET=$OAUTH_CLIENT_SECRET"
echo "JWT_SECRET=$JWT_SECRET"
echo "SESSION_SECRET=$SESSION_SECRET"
```

### 2. Crée le fichier `.env`

```bash
cat > .env << EOF
PORT=4000
DQOS_API_URL=https://dqos-sz.com/api/mcp
SERVER_URL=https://mcp-sz.dqos.cloud
OAUTH_CLIENT_ID=dqos-mcp-client
OAUTH_CLIENT_SECRET=$OAUTH_CLIENT_SECRET
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET
NODE_ENV=production
EOF
```

### 3. Installe et démarre

```bash
npm install
npm run build
pm2 start dist/index.js --name mcp-server-remote
pm2 save
```

## 📝 Configuration dans Claude

### Sur claude.ai (Web)

1. Va dans **Settings > Connectors**
2. Clique sur **"Add custom connector"**
3. Remplis les champs :
   - **Nom :** `DQoS Eswatini`
   - **URL du serveur MCP distant :** `https://mcp-sz.dqos.cloud/mcp`
4. Clique sur **"Advanced settings"**
5. Remplis :
   - **OAuth Client ID :** `dqos-mcp-client`
   - **OAuth Client Secret :** `[la valeur de OAUTH_CLIENT_SECRET]`
6. Clique sur **"Add"**

### Sur Claude Desktop

1. Va dans **Settings > Connectors**
2. Clique sur **"Add custom connector"**
3. Remplis les mêmes infos que ci-dessus

## 🔄 Flux OAuth

```
1. Claude demande l'autorisation
   → GET /oauth/authorize

2. Tu autorises dans ton navigateur
   → POST /oauth/authorize

3. Claude reçoit un code d'autorisation
   → code=abc123...

4. Claude échange le code contre un access token
   → POST /oauth/token

5. Claude utilise l'access token pour appeler les outils
   → Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🧪 Tester OAuth

### 1. Tester la page d'autorisation

Ouvre dans ton navigateur :
```
https://mcp-sz.dqos.cloud/oauth/authorize?client_id=dqos-mcp-client&redirect_uri=https://example.com&response_type=code
```

Tu devrais voir la page d'autorisation.

### 2. Tester l'échange de token

```bash
# Après avoir autorisé et récupéré un code
curl -X POST https://mcp-sz.dqos.cloud/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "TON_CODE",
    "client_id": "dqos-mcp-client",
    "client_secret": "TON_CLIENT_SECRET",
    "redirect_uri": "https://example.com"
  }'
```

Devrait retourner :
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

### 3. Tester avec l'access token

```bash
curl https://mcp-sz.dqos.cloud/mcp/tools \
  -H "Authorization: Bearer TON_ACCESS_TOKEN"
```

## 🔑 Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `PORT` | Port du serveur | `4000` |
| `DQOS_API_URL` | URL de l'API DQoS | `https://dqos-sz.com/api/mcp` |
| `SERVER_URL` | URL publique du serveur | `https://mcp-sz.dqos.cloud` |
| `OAUTH_CLIENT_ID` | ID du client OAuth | `dqos-mcp-client` |
| `OAUTH_CLIENT_SECRET` | Secret du client OAuth | `abc123...` (généré) |
| `JWT_SECRET` | Secret pour signer les JWT | `def456...` (généré) |
| `SESSION_SECRET` | Secret pour les sessions | `ghi789...` (généré) |
| `NODE_ENV` | Environnement | `production` |

## 🔒 Sécurité

### ✅ Bonnes pratiques

1. **Génère des secrets forts** avec `openssl rand -hex 32`
2. **Ne partage JAMAIS** les secrets (CLIENT_SECRET, JWT_SECRET, SESSION_SECRET)
3. **Utilise HTTPS** en production (obligatoire pour OAuth)
4. **Change les secrets régulièrement** (tous les 3-6 mois)
5. **Limite l'accès** aux fichiers `.env` sur le serveur

### ⚠️ Important

- Les secrets doivent être **différents** pour chaque pays/instance
- Les tokens expirent après **24 heures**
- Les codes d'autorisation expirent après **10 minutes**
- Les tokens sont stockés **en mémoire** (pour production, utiliser Redis)

## 🌍 Multi-pays

Pour chaque pays, utilise des secrets différents :

```bash
# Mozambique
OAUTH_CLIENT_ID=dqos-mcp-client-mz
OAUTH_CLIENT_SECRET=secret_mz_unique

# Zambie
OAUTH_CLIENT_ID=dqos-mcp-client-zm
OAUTH_CLIENT_SECRET=secret_zm_unique

# Eswatini
OAUTH_CLIENT_ID=dqos-mcp-client-sz
OAUTH_CLIENT_SECRET=secret_sz_unique
```

## 🆘 Troubleshooting

### Erreur : "invalid_client"

→ Vérifie que `OAUTH_CLIENT_ID` et `OAUTH_CLIENT_SECRET` correspondent dans Claude et sur le serveur.

### Erreur : "invalid_grant"

→ Le code d'autorisation a expiré (10 min) ou a déjà été utilisé.

### Erreur : "Unauthorized"

→ L'access token est invalide ou expiré. Réautorise dans Claude.

### La page d'autorisation ne s'affiche pas

→ Vérifie que `SERVER_URL` est correct dans le `.env`.

## 📚 Ressources

- [OAuth 2.0 RFC](https://datatracker.ietf.org/doc/html/rfc6749)
- [Claude Custom Connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)

---

**Version:** 2.0.0 (avec OAuth)  
**Date:** 26 Novembre 2024

