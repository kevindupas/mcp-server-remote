# ⚡ Déploiement rapide MCP Remote

## 🎯 Tu as déjà Node.js et Certbot ? Parfait !

Utilise le script **simplifié** qui n'installe que PM2 si nécessaire.

## 🚀 Déploiement en 3 commandes

### 1. Upload sur le serveur

```bash
# Depuis ta machine
scp -r mcp-server-remote/ user@ton-serveur.com:/tmp/
```

### 2. Connecte-toi et déploie

```bash
ssh user@ton-serveur.com
cd /tmp/mcp-server-remote
chmod +x deploy-simple.sh
sudo ./deploy-simple.sh
```

### 3. Réponds aux questions

```
Nom de domaine: mcp-mz.dqos.com
URL de l'API DQoS: https://dqos-mz.com/api/mcp
Port: 4000
Configurer SSL ? o
Email: ton@email.com
```

**C'est tout ! 🎉**

## 📝 Ce que le script fait

1. ✅ Vérifie Node.js (déjà installé)
2. ✅ Installe PM2 si besoin
3. ✅ Vérifie Certbot (déjà installé)
4. ✅ Copie les fichiers dans `/var/www/mcp-server-remote`
5. ✅ Génère un token sécurisé automatiquement
6. ✅ Crée le `.env`
7. ✅ `npm install` et `npm run build`
8. ✅ Configure PM2 (redémarrage auto)
9. ✅ Configure Nginx (reverse proxy)
10. ✅ Configure SSL avec Certbot

## 🧪 Vérifier que ça marche

```bash
# Health check
curl https://mcp-mz.dqos.com/health

# Liste des outils (remplace TON_TOKEN par le token affiché)
curl https://mcp-mz.dqos.com/mcp/tools \
  -H "Authorization: Bearer TON_TOKEN"
```

## 📝 Configurer dans Claude Desktop

Le script t'affiche à la fin :

```
📝 Claude Desktop:
   Nom: DQoS MCP
   URL: https://mcp-mz.dqos.com/mcp
   Token: Bearer a3f8d9e2b1c4567890abcdef...
```

Copie ces infos dans Claude Desktop (Settings > Connecteurs personnalisés).

## 🔧 Commandes utiles après déploiement

```bash
# Voir les logs
pm2 logs mcp-server-remote

# Redémarrer
pm2 restart mcp-server-remote

# Status
pm2 status

# Logs Nginx
sudo tail -f /var/log/nginx/mcp-server-remote-access.log
```

## 🔄 Déployer pour un autre pays

Relance le script avec d'autres paramètres :

```bash
# Pour la Zambie
./deploy-simple.sh
# Domaine: mcp-zm.dqos.com
# API: https://dqos-zm.com/api/mcp
# Port: 4001  ← Différent !
```

## 📊 Plusieurs instances sur le même serveur

```bash
# Instance 1 : Mozambique (port 4000)
pm2 list
# mcp-server-remote (port 4000)

# Instance 2 : Zambie (port 4001)
# Redéploie avec port 4001 et nom différent dans PM2
```

---

**Temps de déploiement : ~3 minutes** ⚡

**Difficulté : Facile** 😎

