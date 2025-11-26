# 🎯 Setup Complet MCP Remote - Guide Ultra Rapide

## ⚡ Tu as déjà Node.js et Certbot ? Parfait !

Utilise **deploy-simple.sh** qui installe juste PM2 si besoin.

---

## 🚀 Déploiement en 3 étapes

### Étape 1 : Upload sur ton serveur

```bash
# Depuis ta machine
cd /Users/kevindupas/PNI/DQoS/DQOS
scp -r mcp-server-remote/ user@ton-serveur.com:/tmp/
```

### Étape 2 : Déploie

```bash
# Sur le serveur
ssh user@ton-serveur.com
cd /tmp/mcp-server-remote
chmod +x deploy-simple.sh
sudo ./deploy-simple.sh
```

### Étape 3 : Réponds aux questions

```
Nom de domaine: mcp-mz.dqos.com
URL de l'API DQoS: https://dqos-mz.com/api/mcp
Port: 4000
Configurer SSL ? o
Email: ton@email.com
```

**Terminé ! 🎉**

---

## 🔑 Le MCP_SECRET expliqué

### C'est quoi ?

Un **token d'authentification** pour sécuriser ton serveur MCP.

### Pourquoi ?

Ton serveur sera accessible sur internet. Sans token, n'importe qui pourrait l'utiliser !

### Comment ça marche ?

```
Claude Desktop → Envoie le token
     ↓
Serveur MCP → Vérifie le token
     ↓
Si bon token → OK ✅
Si mauvais → 401 Unauthorized ❌
```

### Le script génère automatiquement un token sécurisé

```bash
MCP_SECRET=$(openssl rand -hex 32)
# Résultat : a3f8d9e2b1c4567890abcdef1234567890abcdef...
```

### Tu le notes et tu le gardes secret !

Le script t'affiche à la fin :

```
🔑 Token: Bearer a3f8d9e2b1c4567890abcdef...
⚠️  GARDE-LE SECRET !
```

---

## 📝 Fichier .env généré automatiquement

Le script crée ce fichier :

```env
PORT=4000
DQOS_API_URL=https://dqos-mz.com/api/mcp
MCP_SECRET=a3f8d9e2b1c4567890abcdef1234567890abcdef...
NODE_ENV=production
```

**Tu n'as rien à faire manuellement !** Le script fait tout. 🎉

---

## 🎯 Configuration dans Claude Desktop

À la fin du déploiement, le script t'affiche :

```
📝 Configuration pour Claude Desktop:
   Nom: DQoS MCP
   URL: https://mcp-mz.dqos.com/mcp
   Token: Bearer a3f8d9e2b1c4567890abcdef...
```

### Dans Claude Desktop :

1. Ouvrir **Settings**
2. Cliquer sur **"Ajouter un connecteur personnalisé"** (BETA)
3. Copier-coller les infos :
   - **Nom :** `DQoS MCP`
   - **URL :** `https://mcp-mz.dqos.com/mcp`
   - **Token :** `Bearer a3f8d9e2b1c4567890abcdef...`
4. Sauvegarder

### Tester

Pose une question à Claude :
```
"Quels sont les opérateurs disponibles ?"
```

Claude va utiliser TON serveur MCP ! 🚀

---

## 🧪 Vérifier que ça marche

### Test 1 : Health check (sans token)

```bash
curl https://mcp-mz.dqos.com/health
```

Devrait retourner :
```json
{"status":"ok","timestamp":"2024-11-25T..."}
```

### Test 2 : Liste des outils (avec token)

```bash
curl https://mcp-mz.dqos.com/mcp/tools \
  -H "Authorization: Bearer TON_TOKEN"
```

Devrait retourner :
```json
{
  "tools": [
    {"name": "get_locations", ...},
    {"name": "get_kpi_data", ...},
    ...
  ]
}
```

### Test 3 : Appeler un outil

```bash
curl -X POST https://mcp-mz.dqos.com/mcp/call-tool \
  -H "Authorization: Bearer TON_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_operators",
    "arguments": {"type": "mobile"}
  }'
```

---

## 🔧 Commandes utiles

```bash
# Voir les logs en temps réel
pm2 logs mcp-server-remote

# Redémarrer le serveur
pm2 restart mcp-server-remote

# Voir le status
pm2 status

# Voir le token
cat /var/www/mcp-server-remote/.env | grep MCP_SECRET

# Logs Nginx
sudo tail -f /var/log/nginx/mcp-server-remote-access.log
```

---

## 🌍 Déployer pour plusieurs pays

### Mozambique

```bash
./deploy-simple.sh
# Domaine: mcp-mz.dqos.com
# API: https://dqos-mz.com/api/mcp
# Port: 4000
```

### Zambie

```bash
./deploy-simple.sh
# Domaine: mcp-zm.dqos.com
# API: https://dqos-zm.com/api/mcp
# Port: 4001  ← Port différent !
```

### Zimbabwe

```bash
./deploy-simple.sh
# Domaine: mcp-zw.dqos.com
# API: https://dqos-zw.com/api/mcp
# Port: 4002  ← Port différent !
```

Puis dans Claude Desktop, ajoute les 3 connecteurs :

```
1. DQoS Mozambique → https://mcp-mz.dqos.com/mcp
2. DQoS Zambie → https://mcp-zm.dqos.com/mcp
3. DQoS Zimbabwe → https://mcp-zw.dqos.com/mcp
```

Claude aura accès aux 3 pays en même temps ! 🌍

---

## 🐛 Problèmes ?

### Le serveur ne démarre pas

```bash
pm2 logs mcp-server-remote
```

### Nginx retourne 502

```bash
# Vérifier que le serveur tourne
pm2 status

# Vérifier les logs
sudo tail -f /var/log/nginx/mcp-server-remote-error.log
```

### SSL ne marche pas

```bash
# Vérifier que le domaine pointe vers le serveur
dig mcp-mz.dqos.com

# Réessayer Certbot
sudo certbot --nginx -d mcp-mz.dqos.com
```

---

## 📊 Résumé

| Étape | Commande | Durée |
|-------|----------|-------|
| Upload | `scp -r ...` | 10s |
| Déploiement | `./deploy-simple.sh` | 2-3 min |
| Configuration Claude | Interface web | 30s |
| **TOTAL** | | **~4 minutes** ⚡ |

---

## 🎉 Résultat final

✅ Serveur MCP accessible sur `https://mcp-mz.dqos.com/mcp`  
✅ Sécurisé avec token Bearer  
✅ HTTPS avec Let's Encrypt  
✅ Redémarrage automatique avec PM2  
✅ Prêt pour Claude Desktop  

**Tes collègues vont être jaloux ! 😎**

---

**Questions ?** Regarde `DEPLOY.md` pour plus de détails !

