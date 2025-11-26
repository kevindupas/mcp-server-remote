# 🔐 MCP_SECRET - Tout ce qu'il faut savoir

## 🎯 C'est quoi ?

Le **MCP_SECRET** est un **token d'authentification** qui sécurise ton serveur MCP Remote.

C'est comme un **mot de passe** que Claude Desktop doit fournir pour accéder à ton serveur.

---

## 🤔 Pourquoi c'est nécessaire ?

Ton serveur MCP sera accessible sur internet (ex: `https://mcp-mz.dqos.com/mcp`).

**Sans token :**
```
❌ N'importe qui peut l'utiliser
❌ N'importe qui peut accéder à tes données DQoS
❌ Risque de surcharge (trop de requêtes)
❌ Risque de sécurité
```

**Avec token :**
```
✅ Seuls ceux qui ont le token peuvent l'utiliser
✅ Tu contrôles qui a accès
✅ Tu peux révoquer l'accès en changeant le token
✅ Sécurité renforcée
```

---

## 🔧 Comment ça marche ?

### 1. Le serveur génère un token

```bash
MCP_SECRET=$(openssl rand -hex 32)
# Résultat : a3f8d9e2b1c4567890abcdef1234567890abcdef1234567890abcdef12345678
```

### 2. Le serveur stocke le token dans `.env`

```env
MCP_SECRET=a3f8d9e2b1c4567890abcdef1234567890abcdef1234567890abcdef12345678
```

### 3. Claude Desktop envoie le token dans chaque requête

```http
GET /mcp/tools HTTP/1.1
Host: mcp-mz.dqos.com
Authorization: Bearer a3f8d9e2b1c4567890abcdef1234567890abcdef1234567890abcdef12345678
```

### 4. Le serveur vérifie le token

```typescript
// Dans src/index.ts
function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  // Vérifie que le header contient "Bearer TON_SECRET"
  if (!authHeader || authHeader !== `Bearer ${MCP_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next(); // Token OK, on continue
}
```

### 5. Si le token est bon → Accès autorisé ✅

```json
{
  "tools": [
    {"name": "get_locations", ...},
    {"name": "get_kpi_data", ...}
  ]
}
```

### 6. Si le token est mauvais → Accès refusé ❌

```json
{
  "error": "Unauthorized"
}
```

---

## 📝 Configuration automatique

### Le script `deploy-simple.sh` fait TOUT automatiquement :

1. ✅ Génère un token sécurisé avec `openssl rand -hex 32`
2. ✅ Crée le fichier `.env` avec le token
3. ✅ Affiche le token à la fin pour que tu le notes

**Tu n'as RIEN à faire manuellement !** 🎉

---

## 🎯 Exemple concret

### Déploiement

```bash
$ ./deploy-simple.sh

Nom de domaine: mcp-mz.dqos.com
URL de l'API DQoS: https://dqos-mz.com/api/mcp
Port: 4000

...

========================================
✅ Déploiement terminé !
========================================

📋 Informations :

🌐 URL: https://mcp-mz.dqos.com/mcp
🔑 Token: Bearer a3f8d9e2b1c4567890abcdef1234567890abcdef1234567890abcdef12345678

⚠️  GARDE LE TOKEN SECRET !

📝 Claude Desktop:
   Nom: DQoS MCP
   URL: https://mcp-mz.dqos.com/mcp
   Token: Bearer a3f8d9e2b1c4567890abcdef1234567890abcdef1234567890abcdef12345678
```

### Configuration dans Claude Desktop

1. Ouvre **Claude Desktop**
2. Va dans **Settings**
3. Clique sur **"Ajouter un connecteur personnalisé"**
4. Copie-colle :
   - **Nom :** `DQoS Mozambique`
   - **URL :** `https://mcp-mz.dqos.com/mcp`
   - **Token :** `Bearer a3f8d9e2b1c4567890abcdef1234567890abcdef1234567890abcdef12345678`
5. Sauvegarde

### Utilisation

Pose une question à Claude :
```
"Quels sont les opérateurs au Mozambique ?"
```

Claude envoie automatiquement le token dans la requête et obtient les données ! 🚀

---

## 🔒 Sécurité

### ✅ Bonnes pratiques

1. **Ne partage JAMAIS le token publiquement**
   - ❌ Ne le mets pas sur GitHub
   - ❌ Ne le mets pas dans un email
   - ❌ Ne le mets pas dans un chat public

2. **Utilise un token différent par pays**
   ```
   Mozambique : Bearer abc123...
   Zambie : Bearer def456...
   Zimbabwe : Bearer ghi789...
   ```

3. **Change le token régulièrement**
   ```bash
   # Sur le serveur
   cd /var/www/mcp-server-remote
   
   # Génère un nouveau token
   NEW_TOKEN=$(openssl rand -hex 32)
   
   # Modifie .env
   sed -i "s/MCP_SECRET=.*/MCP_SECRET=$NEW_TOKEN/" .env
   
   # Redémarre
   pm2 restart mcp-server-remote
   ```

4. **Révoque l'accès si nécessaire**
   - Change le token
   - L'ancien token ne marche plus
   - Seuls ceux avec le nouveau token ont accès

---

## 🧪 Tester le token

### Test 1 : Sans token (devrait échouer)

```bash
curl https://mcp-mz.dqos.com/mcp/tools
```

**Résultat attendu :**
```json
{
  "error": "Unauthorized"
}
```

### Test 2 : Avec mauvais token (devrait échouer)

```bash
curl https://mcp-mz.dqos.com/mcp/tools \
  -H "Authorization: Bearer MAUVAIS_TOKEN"
```

**Résultat attendu :**
```json
{
  "error": "Unauthorized"
}
```

### Test 3 : Avec bon token (devrait marcher)

```bash
curl https://mcp-mz.dqos.com/mcp/tools \
  -H "Authorization: Bearer a3f8d9e2b1c4567890abcdef..."
```

**Résultat attendu :**
```json
{
  "tools": [
    {"name": "get_locations", ...},
    {"name": "get_kpi_data", ...}
  ]
}
```

---

## 📊 Comparaison avec d'autres systèmes

| Système | Équivalent |
|---------|-----------|
| **API REST** | API Key |
| **JWT** | Token d'authentification |
| **OAuth** | Access Token |
| **MCP Remote** | **MCP_SECRET** (Bearer Token) |

C'est exactement le même principe qu'une API key classique ! 🔑

---

## 🎯 Résumé ultra rapide

### MCP_SECRET c'est :

✅ Un **token d'authentification** généré automatiquement  
✅ Stocké dans `.env` sur le serveur  
✅ Envoyé par Claude Desktop dans chaque requête  
✅ Vérifié par le serveur avant d'autoriser l'accès  
✅ **Comme un mot de passe** pour ton serveur MCP  

### Tu dois :

✅ Le **noter** quand le script l'affiche  
✅ Le **copier** dans Claude Desktop  
✅ Le **garder secret**  
✅ Ne **JAMAIS** le partager publiquement  

### Tu n'as PAS besoin de :

❌ Le générer manuellement (le script le fait)  
❌ Le configurer manuellement (le script le fait)  
❌ Comprendre la crypto (le script le fait)  

**Le script fait TOUT automatiquement ! 🎉**

---

## 🚀 Prêt à déployer ?

```bash
# 1. Lance le script
./deploy-simple.sh

# 2. Note le token affiché à la fin

# 3. Configure Claude Desktop avec le token

# 4. Teste !
```

**C'est tout ! 🎊**

---

**Questions ?** Regarde `COMPLETE_SETUP.md` pour le guide complet !

