#!/bin/bash

# 🚀 Script de déploiement SIMPLE - Suppose que tout est déjà installé
# Usage: ./deploy-simple.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 Déploiement MCP Remote (Simple)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Configuration
read -p "Nom de domaine (ex: mcp-mz.dqos.com): " DOMAIN
read -p "URL de l'API DQoS (ex: https://dqos-mz.com/api/mcp): " API_URL
read -p "Port (défaut: 4000): " PORT
PORT=${PORT:-4000}

# Générer token
MCP_SECRET=$(openssl rand -hex 32)

echo ""
echo -e "${GREEN}✓ Configuration${NC}"
echo ""

# Répertoire de déploiement
DEPLOY_DIR="/var/www/mcp-server-remote"
sudo mkdir -p $DEPLOY_DIR
sudo cp -r . $DEPLOY_DIR/
sudo chown -R $USER:$USER $DEPLOY_DIR

cd $DEPLOY_DIR

# Créer .env
cat > .env << EOF
PORT=$PORT
DQOS_API_URL=$API_URL
MCP_SECRET=$MCP_SECRET
NODE_ENV=production
EOF

echo -e "${GREEN}✓ Fichier .env créé${NC}"

# Installer et build
echo "Installation des dépendances..."
npm install

echo "Build du projet..."
npm run build

echo -e "${GREEN}✓ Projet buildé${NC}"

# PM2
pm2 stop mcp-server-remote 2>/dev/null || true
pm2 delete mcp-server-remote 2>/dev/null || true
pm2 start dist/index.js --name mcp-server-remote
pm2 save

echo -e "${GREEN}✓ PM2 configuré${NC}"

# Nginx
sudo tee /etc/nginx/sites-available/mcp-server-remote > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;

    access_log /var/log/nginx/mcp-server-remote-access.log;
    error_log /var/log/nginx/mcp-server-remote-error.log;

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
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/mcp-server-remote /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

echo -e "${GREEN}✓ Nginx configuré${NC}"
echo ""

# SSL
read -p "Configurer SSL/HTTPS ? (o/n): " SETUP_SSL
if [[ $SETUP_SSL == "o" || $SETUP_SSL == "O" ]]; then
    read -p "Email pour Let's Encrypt: " EMAIL
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect
    echo -e "${GREEN}✓ SSL configuré${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Déploiement terminé !${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}📋 Informations :${NC}"
echo ""
if [[ $SETUP_SSL == "o" ]]; then
    echo -e "🌐 URL: ${GREEN}https://$DOMAIN/mcp${NC}"
else
    echo -e "🌐 URL: ${YELLOW}http://$DOMAIN/mcp${NC}"
fi
echo -e "🔑 Token: ${GREEN}Bearer $MCP_SECRET${NC}"
echo ""
echo -e "${RED}⚠️  GARDE LE TOKEN SECRET !${NC}"
echo ""
echo -e "${YELLOW}🧪 Test:${NC}"
if [[ $SETUP_SSL == "o" ]]; then
    echo -e "   ${BLUE}curl https://$DOMAIN/health${NC}"
    echo -e "   ${BLUE}curl https://$DOMAIN/mcp/tools -H \"Authorization: Bearer $MCP_SECRET\"${NC}"
else
    echo -e "   ${BLUE}curl http://$DOMAIN/health${NC}"
    echo -e "   ${BLUE}curl http://$DOMAIN/mcp/tools -H \"Authorization: Bearer $MCP_SECRET\"${NC}"
fi
echo ""
echo -e "${YELLOW}📝 Claude Desktop:${NC}"
echo -e "   Nom: DQoS MCP"
if [[ $SETUP_SSL == "o" ]]; then
    echo -e "   URL: ${GREEN}https://$DOMAIN/mcp${NC}"
else
    echo -e "   URL: ${YELLOW}http://$DOMAIN/mcp${NC}"
fi
echo -e "   Token: ${GREEN}Bearer $MCP_SECRET${NC}"
echo ""

