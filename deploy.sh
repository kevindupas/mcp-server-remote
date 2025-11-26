#!/bin/bash

# 🚀 Script de déploiement MCP Remote Server sur Ubuntu + Nginx
# Usage: ./deploy.sh

set -e  # Arrêter en cas d'erreur

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 Déploiement MCP Remote Server${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================
# 1. CONFIGURATION
# ============================================

echo -e "${YELLOW}📝 Configuration${NC}"
echo ""

# Demander les informations
read -p "Nom de domaine (ex: mcp-mz.dqos.com): " DOMAIN
read -p "URL de l'API DQoS (ex: https://dqos-mz.com/api/mcp): " API_URL
read -p "Port du serveur MCP (défaut: 4000): " PORT
PORT=${PORT:-4000}

# Générer un token sécurisé
MCP_SECRET=$(openssl rand -hex 32)

echo ""
echo -e "${GREEN}✓ Configuration enregistrée${NC}"
echo -e "  Domaine: ${DOMAIN}"
echo -e "  API URL: ${API_URL}"
echo -e "  Port: ${PORT}"
echo -e "  Secret: ${MCP_SECRET:0:20}..."
echo ""

# ============================================
# 2. VÉRIFICATION DES DÉPENDANCES
# ============================================

echo -e "${YELLOW}📦 Vérification des dépendances${NC}"

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js n'est pas installé${NC}"
    echo "Installation de Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo -e "${GREEN}✓ Node.js installé ($(node -v))${NC}"
fi

# Vérifier npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm n'est pas installé${NC}"
    exit 1
else
    echo -e "${GREEN}✓ npm installé ($(npm -v))${NC}"
fi

# Vérifier Nginx
if ! command -v nginx &> /dev/null; then
    echo -e "${RED}✗ Nginx n'est pas installé${NC}"
    echo "Installation de Nginx..."
    sudo apt-get update
    sudo apt-get install -y nginx
else
    echo -e "${GREEN}✓ Nginx installé${NC}"
fi

# Vérifier PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 n'est pas installé${NC}"
    echo "Installation de PM2..."
    sudo npm install -g pm2
    echo -e "${GREEN}✓ PM2 installé${NC}"
else
    echo -e "${GREEN}✓ PM2 installé ($(pm2 -v))${NC}"
fi

# Vérifier Certbot
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}⚠️  Certbot n'est pas installé${NC}"
    echo "Installation de Certbot..."
    sudo apt-get install -y certbot python3-certbot-nginx
    echo -e "${GREEN}✓ Certbot installé${NC}"
else
    echo -e "${GREEN}✓ Certbot installé${NC}"
fi

echo ""

# ============================================
# 3. PRÉPARATION DU PROJET
# ============================================

echo -e "${YELLOW}🔧 Préparation du projet${NC}"

# Créer le répertoire de déploiement
DEPLOY_DIR="/var/www/mcp-server-remote"
sudo mkdir -p $DEPLOY_DIR

# Copier les fichiers (depuis le répertoire actuel)
echo "Copie des fichiers..."
sudo cp -r . $DEPLOY_DIR/
sudo chown -R $USER:$USER $DEPLOY_DIR

cd $DEPLOY_DIR

# Créer le fichier .env
echo "Création du fichier .env..."
cat > .env << EOF
PORT=$PORT
DQOS_API_URL=$API_URL
MCP_SECRET=$MCP_SECRET
NODE_ENV=production
EOF

echo -e "${GREEN}✓ Fichier .env créé${NC}"

# Installer les dépendances npm
echo "Installation des dépendances npm..."
npm install

# Build du projet TypeScript
echo "Build du projet..."
npm run build

echo -e "${GREEN}✓ Projet préparé${NC}"
echo ""

# ============================================
# 4. CONFIGURATION PM2
# ============================================

echo -e "${YELLOW}⚙️  Configuration PM2${NC}"

# Arrêter PM2 si déjà lancé
pm2 stop mcp-server-remote 2>/dev/null || true
pm2 delete mcp-server-remote 2>/dev/null || true

# Lancer avec PM2
pm2 start dist/index.js --name mcp-server-remote
pm2 save
pm2 startup | tail -n 1 | sudo bash

echo -e "${GREEN}✓ PM2 configuré${NC}"
echo ""

# ============================================
# 5. CONFIGURATION NGINX
# ============================================

echo -e "${YELLOW}🌐 Configuration Nginx${NC}"

# Créer le fichier de configuration Nginx
sudo tee /etc/nginx/sites-available/mcp-server-remote > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Logs
    access_log /var/log/nginx/mcp-server-remote-access.log;
    error_log /var/log/nginx/mcp-server-remote-error.log;

    # Proxy vers Node.js
    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts pour les requêtes longues
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:$PORT/health;
        access_log off;
    }
}
EOF

# Activer le site
sudo ln -sf /etc/nginx/sites-available/mcp-server-remote /etc/nginx/sites-enabled/

# Tester la configuration Nginx
echo "Test de la configuration Nginx..."
sudo nginx -t

# Recharger Nginx
echo "Rechargement de Nginx..."
sudo systemctl reload nginx

echo -e "${GREEN}✓ Nginx configuré${NC}"
echo ""

# ============================================
# 6. CONFIGURATION SSL (HTTPS)
# ============================================

echo -e "${YELLOW}🔒 Configuration SSL avec Let's Encrypt${NC}"
echo ""
read -p "Voulez-vous configurer HTTPS avec Let's Encrypt ? (o/n): " SETUP_SSL

if [[ $SETUP_SSL == "o" || $SETUP_SSL == "O" ]]; then
    echo "Configuration de SSL..."
    
    # Vérifier que le domaine pointe vers ce serveur
    echo -e "${YELLOW}⚠️  Assurez-vous que le domaine $DOMAIN pointe vers ce serveur !${NC}"
    read -p "Continuer ? (o/n): " CONTINUE
    
    if [[ $CONTINUE == "o" || $CONTINUE == "O" ]]; then
        read -p "Email pour Let's Encrypt: " EMAIL
        sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect
        echo -e "${GREEN}✓ SSL configuré${NC}"
    else
        echo -e "${YELLOW}⚠️  SSL non configuré. Vous pouvez le faire plus tard avec:${NC}"
        echo -e "   sudo certbot --nginx -d $DOMAIN"
    fi
else
    echo -e "${YELLOW}⚠️  SSL non configuré. Vous pouvez le faire plus tard avec:${NC}"
    echo -e "   sudo certbot --nginx -d $DOMAIN"
fi

echo ""

# ============================================
# 7. FIREWALL
# ============================================

echo -e "${YELLOW}🔥 Configuration du firewall${NC}"

# Vérifier si UFW est installé
if command -v ufw &> /dev/null; then
    sudo ufw allow 'Nginx Full'
    sudo ufw allow 22  # SSH
    echo -e "${GREEN}✓ Firewall configuré${NC}"
else
    echo -e "${YELLOW}⚠️  UFW non installé. Firewall non configuré.${NC}"
fi

echo ""

# ============================================
# 8. VÉRIFICATION
# ============================================

echo -e "${YELLOW}🧪 Vérification du déploiement${NC}"

# Attendre que le serveur démarre
sleep 3

# Tester le serveur
echo "Test du serveur..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/health)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Serveur fonctionne correctement${NC}"
else
    echo -e "${RED}✗ Erreur: Le serveur ne répond pas correctement (HTTP $HTTP_CODE)${NC}"
fi

# Vérifier PM2
echo "Vérification PM2..."
pm2 list

echo ""

# ============================================
# 9. RÉSUMÉ
# ============================================

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Déploiement terminé !${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}📋 Informations importantes :${NC}"
echo ""
echo -e "🌐 URL du serveur MCP:"
if [[ $SETUP_SSL == "o" || $SETUP_SSL == "O" ]]; then
    echo -e "   ${GREEN}https://$DOMAIN/mcp${NC}"
else
    echo -e "   ${YELLOW}http://$DOMAIN/mcp${NC}"
    echo -e "   ${RED}⚠️  Pensez à configurer HTTPS !${NC}"
fi
echo ""
echo -e "🔑 Token d'authentification (MCP_SECRET):"
echo -e "   ${GREEN}$MCP_SECRET${NC}"
echo -e "   ${RED}⚠️  GARDE-LE SECRET ! Note-le quelque part de sûr.${NC}"
echo ""
echo -e "📝 Configuration pour Claude Desktop:"
echo -e "   Nom: DQoS MCP"
if [[ $SETUP_SSL == "o" || $SETUP_SSL == "O" ]]; then
    echo -e "   URL: ${GREEN}https://$DOMAIN/mcp${NC}"
else
    echo -e "   URL: ${YELLOW}http://$DOMAIN/mcp${NC}"
fi
echo -e "   Token: ${GREEN}Bearer $MCP_SECRET${NC}"
echo ""
echo -e "${YELLOW}🔧 Commandes utiles :${NC}"
echo -e "   Voir les logs:        ${BLUE}pm2 logs mcp-server-remote${NC}"
echo -e "   Redémarrer:           ${BLUE}pm2 restart mcp-server-remote${NC}"
echo -e "   Arrêter:              ${BLUE}pm2 stop mcp-server-remote${NC}"
echo -e "   Status:               ${BLUE}pm2 status${NC}"
echo -e "   Logs Nginx:           ${BLUE}sudo tail -f /var/log/nginx/mcp-server-remote-*.log${NC}"
echo ""
echo -e "${YELLOW}🧪 Tester l'API :${NC}"
if [[ $SETUP_SSL == "o" || $SETUP_SSL == "O" ]]; then
    echo -e "   ${BLUE}curl https://$DOMAIN/health${NC}"
    echo -e "   ${BLUE}curl https://$DOMAIN/mcp/tools -H \"Authorization: Bearer $MCP_SECRET\"${NC}"
else
    echo -e "   ${BLUE}curl http://$DOMAIN/health${NC}"
    echo -e "   ${BLUE}curl http://$DOMAIN/mcp/tools -H \"Authorization: Bearer $MCP_SECRET\"${NC}"
fi
echo ""
echo -e "${GREEN}🎉 Ton serveur MCP Remote est prêt !${NC}"
echo ""

