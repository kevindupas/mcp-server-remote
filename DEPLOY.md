# 🚀 Guide de déploiement sur Ubuntu + Nginx

## 📋 Prérequis

- Serveur Ubuntu 20.04+ avec accès root/sudo
- Nom de domaine pointant vers ton serveur (ex: `mcp-mz.dqos.com`)
- Port 80 et 443 ouverts

## 🎯 Déploiement automatique

### 1. Upload les fichiers sur le serveur

```bash
# Depuis ta machine locale
scp -r mcp-server-remote/ user@ton-serveur.com:/tmp/
```

### 2. Connecte-toi au serveur

```bash
ssh user@ton-serveur.com
```

### 3. Lance le script de déploiement

```bash
cd /tmp/mcp-server-remote
chmod +x deploy.sh
sudo ./deploy.sh
```

Le script va te demander :
- **Nom de domaine** : `mcp-mz.dqos.com`
- **URL de l'API DQoS** : `https://dqos-mz.com/api/mcp`
- **Port** : `4000` (ou autre)
- **Email pour SSL** : `ton@email.com`

### 4. C'est tout ! 🎉

Le script fait automatiquement :
- ✅ Installation de Node.js, Nginx, PM2, Certbot
- ✅ Build du projet TypeScript
- ✅ Configuration PM2 (redémarrage auto)
- ✅ Configuration Nginx (reverse proxy)
- ✅ Configuration SSL/HTTPS (Let's Encrypt)
- ✅ Configuration firewall

## 🧪 Vérification

### Test local

```bash
# Health check
curl http://localhost:4000/health

# Liste des outils (avec token)
curl http://localhost:4000/mcp/tools \
  -H "Authorization: Bearer TON_SECRET"
```

### Test public

```bash
# Health check
curl https://mcp-mz.dqos.com/health

# Liste des outils
curl https://mcp-mz.dqos.com/mcp/tools \
  -H "Authorization: Bearer TON_SECRET"
```

## 🔧 Commandes utiles

### PM2

```bash
# Voir les logs en temps réel
pm2 logs mcp-server-remote

# Redémarrer
pm2 restart mcp-server-remote

# Arrêter
pm2 stop mcp-server-remote

# Status
pm2 status

# Voir les infos détaillées
pm2 show mcp-server-remote
```

### Nginx

```bash
# Tester la config
sudo nginx -t

# Recharger
sudo systemctl reload nginx

# Redémarrer
sudo systemctl restart nginx

# Voir les logs
sudo tail -f /var/log/nginx/mcp-server-remote-access.log
sudo tail -f /var/log/nginx/mcp-server-remote-error.log
```

### SSL (Let's Encrypt)

```bash
# Renouveler manuellement
sudo certbot renew

# Tester le renouvellement
sudo certbot renew --dry-run

# Voir les certificats
sudo certbot certificates
```

## 🔄 Mise à jour

Pour mettre à jour le serveur :

```bash
# 1. Aller dans le dossier
cd /var/www/mcp-server-remote

# 2. Pull les changements (si Git)
git pull

# 3. Installer les dépendances
npm install

# 4. Rebuild
npm run build

# 5. Redémarrer PM2
pm2 restart mcp-server-remote
```

## 🌍 Déployer plusieurs instances (multi-pays)

### Option 1 : Plusieurs serveurs

Déploie sur des serveurs différents :

```bash
# Serveur 1 : Mozambique
mcp-mz.dqos.com → Serveur 1

# Serveur 2 : Zambie
mcp-zm.dqos.com → Serveur 2
```

### Option 2 : Plusieurs instances sur le même serveur

```bash
# Instance 1 : Mozambique (port 4000)
cd /var/www/mcp-server-mz
PORT=4000 DQOS_API_URL=https://dqos-mz.com/api/mcp pm2 start dist/index.js --name mcp-mz

# Instance 2 : Zambie (port 4001)
cd /var/www/mcp-server-zm
PORT=4001 DQOS_API_URL=https://dqos-zm.com/api/mcp pm2 start dist/index.js --name mcp-zm

# Instance 3 : Zimbabwe (port 4002)
cd /var/www/mcp-server-zw
PORT=4002 DQOS_API_URL=https://dqos-zw.com/api/mcp pm2 start dist/index.js --name mcp-zw
```

Puis configure Nginx pour chaque domaine :

```nginx
# /etc/nginx/sites-available/mcp-mz
server {
    server_name mcp-mz.dqos.com;
    location / {
        proxy_pass http://localhost:4000;
    }
}

# /etc/nginx/sites-available/mcp-zm
server {
    server_name mcp-zm.dqos.com;
    location / {
        proxy_pass http://localhost:4001;
    }
}
```

## 🐛 Dépannage

### Le serveur ne démarre pas

```bash
# Voir les logs PM2
pm2 logs mcp-server-remote

# Vérifier le fichier .env
cat /var/www/mcp-server-remote/.env

# Tester manuellement
cd /var/www/mcp-server-remote
node dist/index.js
```

### Nginx retourne 502 Bad Gateway

```bash
# Vérifier que le serveur Node.js tourne
pm2 status

# Vérifier les logs Nginx
sudo tail -f /var/log/nginx/mcp-server-remote-error.log

# Vérifier que le port est correct dans Nginx
sudo cat /etc/nginx/sites-available/mcp-server-remote
```

### SSL ne fonctionne pas

```bash
# Vérifier que le domaine pointe vers le serveur
dig mcp-mz.dqos.com

# Réessayer Certbot
sudo certbot --nginx -d mcp-mz.dqos.com

# Voir les logs Certbot
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

### Erreur "Unauthorized"

Vérifie que tu utilises le bon token :

```bash
# Voir le token dans .env
cat /var/www/mcp-server-remote/.env | grep MCP_SECRET

# Tester avec le bon token
curl https://mcp-mz.dqos.com/mcp/tools \
  -H "Authorization: Bearer TON_VRAI_TOKEN"
```

## 📊 Monitoring

### Logs en temps réel

```bash
# PM2
pm2 logs mcp-server-remote --lines 100

# Nginx access
sudo tail -f /var/log/nginx/mcp-server-remote-access.log

# Nginx errors
sudo tail -f /var/log/nginx/mcp-server-remote-error.log
```

### Statistiques PM2

```bash
pm2 monit
```

### Espace disque

```bash
df -h
```

### Mémoire

```bash
free -h
```

## 🔐 Sécurité

### Changer le MCP_SECRET

```bash
# 1. Générer un nouveau token
NEW_SECRET=$(openssl rand -hex 32)

# 2. Mettre à jour .env
cd /var/www/mcp-server-remote
sed -i "s/MCP_SECRET=.*/MCP_SECRET=$NEW_SECRET/" .env

# 3. Redémarrer
pm2 restart mcp-server-remote

# 4. Afficher le nouveau token
echo $NEW_SECRET
```

### Limiter l'accès par IP (optionnel)

Dans Nginx :

```nginx
location /mcp {
    # Autoriser seulement certaines IPs
    allow 1.2.3.4;      # IP de ton bureau
    allow 5.6.7.8;      # IP de ton VPN
    deny all;
    
    proxy_pass http://localhost:4000;
}
```

## 📝 Checklist de déploiement

- [ ] Serveur Ubuntu avec accès root
- [ ] Domaine pointant vers le serveur
- [ ] Ports 80 et 443 ouverts
- [ ] Script `deploy.sh` exécuté
- [ ] SSL configuré (HTTPS)
- [ ] Test avec `curl` réussi
- [ ] Token MCP_SECRET noté en lieu sûr
- [ ] Configuration dans Claude Desktop
- [ ] Test avec Claude réussi

---

**Besoin d'aide ?** Consulte les logs avec `pm2 logs` ! 🚀

