# DartFlow

DartFlow est une PWA de comptage de fléchettes qui fonctionne hors ligne et synchronise facultativement les profils, parties et statistiques avec un compte.

## Structure

- `front/` : PWA Next.js, moteur de jeu, Dexie et interfaces.
- `back/` : API Fastify, authentification, synchronisation, partages et classements.
- `shared/` : contrats TypeScript communs.
- `docker-compose.yml` : frontend, API et PostgreSQL.

## Développement local

Prérequis : Node.js 22 et PostgreSQL.

```bash
npm install
cp .env.example .env
npm run dev:back
npm run dev:front
```

L’API utilise `postgres://dartflow:dartflow@localhost:5432/dartflow` par défaut en développement. Les migrations sont appliquées automatiquement au démarrage.

## Docker

Créez `.env` à partir de `.env.example`, remplacez au minimum les mots de passe et le secret JWT, puis lancez :

```bash
docker compose up --build -d
```

L’application est exposée sur `http://localhost:3000`. PostgreSQL reste interne au réseau Docker et ses données sont conservées dans le volume `dartflow-postgres`.

En production, placez l’application derrière un reverse proxy HTTPS, définissez `FRONTEND_ORIGIN` avec l’URL publique exacte et passez `COOKIE_SECURE=true`. La valeur `false` de l’exemple sert uniquement au Docker local en HTTP. HTTPS est nécessaire pour l’installation PWA hors localhost et protège les cookies de session.

## Synchronisation

Dexie reste la source immédiate sur l’appareil. Après connexion :

1. les profils et parties sans propriétaire cloud sont rattachés au compte ;
2. les changements sont synchronisés après chaque sauvegarde ;
3. hors ligne, ils restent locaux et repartent au retour du réseau ;
4. les données du serveur permettent de restaurer un nouvel appareil.

Les comptes utilisent un nom public unique `@pseudo`. Après acceptation d’une demande d’ami, le propriétaire d’un profil peut donner un droit d’utilisation ou de gestion. Deux comptes différents peuvent posséder des profils portant le même nom ; l’identité réelle reste l’UUID du profil et son propriétaire.

Le cookie d’accès expire par défaut après 4 heures. Un jeton de rafraîchissement opaque, rotatif et stocké sous forme hachée en base renouvelle automatiquement la session pendant 30 jours sans redemander le mot de passe. Ces durées se configurent avec `ACCESS_TOKEN_TTL_HOURS` et `REFRESH_TOKEN_TTL_DAYS`.

Seuls les profils rendus publics par leur propriétaire apparaissent dans le classement amical en ligne, sous la forme `Profil · @propriétaire`.
