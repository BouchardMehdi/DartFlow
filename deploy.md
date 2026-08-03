# Déploiement de DartFlow sur le VPS

Cette procédure déploie DartFlow à l’adresse `https://dartflow.bouchard-mehdi.fr` avec :

- Next.js sur `127.0.0.1:8088` ;
- Fastify sur `127.0.0.1:3008` ;
- PostgreSQL uniquement dans Docker, sans port public ;
- Nginx pour le site, l’API et le WebSocket ;
- Certbot pour HTTPS.

Si ces ports sont déjà utilisés par un autre projet, choisissez deux ports libres et remplacez-les à la fois dans `.env` et dans `deploy/nginx-dartflow.conf`.

## 1. Préparer le DNS

Dans la zone DNS Hostinger de `bouchard-mehdi.fr`, créez :

```text
Type : A
Nom : dartflow
Pointe vers : 185.98.138.157
TTL : 14400
```

Vérifiez la propagation depuis votre ordinateur :

```bash
nslookup dartflow.bouchard-mehdi.fr
```

La réponse doit contenir l’adresse IP du VPS avant de demander le certificat.

## 2. Vérifier les ports sur le VPS

```bash
sudo ss -lntp | grep -E ':8088|:3008' || true
```

L’absence de résultat signifie que les ports sont disponibles.

## 3. Cloner le projet

```bash
sudo mkdir -p /home/projects
sudo chown "$USER":"$USER" /home/projects
cd /home/projects
git clone <URL_DU_DEPOT_GIT> dartflow
cd dartflow
```

## 4. Créer le fichier `.env`

Créez deux secrets différents :

```bash
openssl rand -hex 32
openssl rand -hex 64
```

Le premier résultat servira de mot de passe PostgreSQL et le second de secret JWT. Ne les publiez jamais et ne réutilisez pas un secret d’un autre projet.

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

Le contenu attendu est :

```dotenv
POSTGRES_DB=dartflow
POSTGRES_USER=dartflow
POSTGRES_PASSWORD=<RESULTAT_DE_OPENSSL_RAND_HEX_32>

JWT_SECRET=<RESULTAT_DE_OPENSSL_RAND_HEX_64>

FRONTEND_ORIGIN=https://dartflow.bouchard-mehdi.fr
FRONT_PORT=8088
BACK_PORT=3008

NEXT_PUBLIC_REALTIME_URL=

ACCESS_TOKEN_TTL_HOURS=4
REFRESH_TOKEN_TTL_DAYS=30
COOKIE_SECURE=true
```

`NEXT_PUBLIC_REALTIME_URL` reste volontairement vide : le navigateur utilisera automatiquement `wss://dartflow.bouchard-mehdi.fr/realtime`. Ne mettez pas de guillemets autour des secrets.

`NODE_ENV=production` est imposé directement au conteneur backend dans `docker-compose.yml`, il n’est donc pas nécessaire de le dupliquer dans `.env`.

Contrôlez que Git ignore bien le fichier :

```bash
git check-ignore .env
```

La commande doit afficher `.env`.

## 5. Construire et lancer Docker

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100
```

Les trois services doivent finir dans l’état `running` et les healthchecks doivent devenir `healthy`.

Vérifiez localement sur le VPS :

```bash
curl --fail http://127.0.0.1:3008/health
curl -I --fail http://127.0.0.1:8088/
```

La première commande doit retourner `{"status":"ok"}` et la seconde un code HTTP valide.

Vérifiez aussi que PostgreSQL n’est pas publié :

```bash
docker compose port postgres 5432
```

Cette dernière commande ne doit afficher aucun port public.

## 6. Configurer Nginx

Le fichier prêt à l’emploi est `deploy/nginx-dartflow.conf`. Il route :

- `/` vers Next.js ;
- `/api/` vers Fastify en retirant le préfixe `/api` ;
- `/realtime` vers le WebSocket Fastify avec les en-têtes d’upgrade.

Installez-le :

```bash
sudo cp deploy/nginx-dartflow.conf /etc/nginx/sites-available/dartflow
sudo ln -s /etc/nginx/sites-available/dartflow /etc/nginx/sites-enabled/dartflow
sudo nginx -t
sudo systemctl reload nginx
```

Si le lien existe déjà, ne le recréez pas. Modifiez plutôt le fichier dans `sites-available`, puis relancez `nginx -t`.

Testez avant HTTPS :

```bash
curl -I http://dartflow.bouchard-mehdi.fr/
curl --fail http://dartflow.bouchard-mehdi.fr/api/health
```

## 7. Activer HTTPS avec Certbot

```bash
sudo certbot --nginx -d dartflow.bouchard-mehdi.fr
```

Choisissez la redirection automatique HTTP vers HTTPS, puis vérifiez :

```bash
sudo nginx -t
curl -I https://dartflow.bouchard-mehdi.fr/
curl --fail https://dartflow.bouchard-mehdi.fr/api/health
sudo certbot renew --dry-run
```

Ouvrez ensuite `https://dartflow.bouchard-mehdi.fr` dans un navigateur. Testez la création d’un compte, une partie, le chat d’un club et l’installation de la PWA. Dans les outils réseau du navigateur, la connexion `/realtime` doit obtenir le statut `101 Switching Protocols` après connexion.

## 8. Mettre à jour l’application

```bash
cd /home/projects/dartflow
git pull --ff-only
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=50
```

Il n’est pas nécessaire de lancer `docker compose down`. Ne lancez jamais `docker compose down -v`, car l’option `-v` supprime le volume PostgreSQL.

## 9. Sauvegarder PostgreSQL

Créez un dossier accessible uniquement à votre utilisateur :

```bash
mkdir -p /home/backups/dartflow
chmod 700 /home/backups/dartflow
```

Sauvegarde manuelle :

```bash
cd /home/projects/dartflow
docker compose exec -T postgres pg_dump -U dartflow -d dartflow -Fc > /home/backups/dartflow/dartflow-$(date +%F-%H%M%S).dump
```

Copiez régulièrement ces sauvegardes hors du VPS. Un volume Docker protège les données lors d’une reconstruction des conteneurs, mais ce n’est pas une sauvegarde contre une panne ou une suppression du serveur.

## 10. Diagnostic rapide

```bash
cd /home/projects/dartflow
docker compose ps
docker compose logs --tail=200 front
docker compose logs --tail=200 back
docker compose logs --tail=200 postgres
sudo nginx -t
sudo journalctl -u nginx --since "30 minutes ago"
```

Points importants :

- un `502 Bad Gateway` signifie généralement que le conteneur ciblé n’est pas démarré ou que le port Nginx ne correspond pas à `.env` ;
- une erreur de connexion côté compte peut venir d’un mauvais `FRONTEND_ORIGIN` ou de `COOKIE_SECURE=false` en production ;
- un chat qui ne s’actualise pas en direct indique généralement que le bloc Nginx `/realtime` ou ses en-têtes WebSocket sont absents ;
- après une modification de `NEXT_PUBLIC_REALTIME_URL`, reconstruisez le frontend, car cette variable est intégrée pendant le build.
