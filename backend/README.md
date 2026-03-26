# APINode (Backend - PDFs asynchrones)

Ce projet backend expose une API Express pour créer des lots (`Batch`) de génération de documents. Les traitements lourds (génération de PDF) sont délégués à une file asynchrone BullMQ alimentée par Redis.

## Prérequis

- Docker et Docker Compose (v2)
- Node.js (version compatible avec le projet)
- Un accès à MongoDB et Redis via Docker (fourni par `docker-compose.yml`)

## Configuration

1. Copiez le fichier d'exemple :

   `cp .env.example .env`

2. Vérifiez/ajustez les variables d'environnement si besoin.

Variables utilisées :
- `PORT`
- `MONGODB_URI`
- `REDIS_HOST`
- `REDIS_PORT`
- `PDF_STORAGE_PATH`
- `BATCH_MIN_SIZE` (optionnel, défaut 1)
- `BATCH_MAX_SIZE` (optionnel, défaut 5000)

## Démarrer l'infrastructure (Docker)

Lancez MongoDB et Redis :

```bash
docker compose up -d
```

## Installer les dépendances

```bash
npm install
```

## Lint

```bash
npm run lint
```

## Tests

```bash
npm run test
```

## Lancer l'API

```bash
npm run dev
```

- L'API est disponible sur `http://localhost:${PORT}`
- Endpoint de santé :
  - `GET /health`
- Endpoint de création de batch :
  - `POST /api/documents/batch`
  - Le body attendu est un tableau JSON contenant entre `BATCH_MIN_SIZE` et `BATCH_MAX_SIZE` IDs (strings non vides).

## Lancer le Worker (process indépendant)

Dans un deuxième terminal :

```bash
npx ts-node src/workers/documentWorker.ts
```

Le worker :
- écoute la queue BullMQ `pdf-generation`
- génère un PDF par job dans `PDF_STORAGE_PATH` (par défaut `storage/pdfs/`)
- met à jour le statut du `Batch` dans MongoDB

## Architecture

### BullMQ (traitement asynchrone)

- Le contrôleur `batchController` crée un document `Batch` dans MongoDB avec `status: "pending"`.
- Il ajoute ensuite **1000 jobs d'un coup** via `documentQueue.addBulk()` dans la queue BullMQ nommée **`pdf-generation`** (un job par `userId`).
- Le worker `documentWorker` consomme la queue et traite les jobs en parallèle (configurable via `concurrency`).

Ce découpage permet de ne pas bloquer les requêtes HTTP pendant la génération de PDFs.

### Opossum (Circuit Breaker pour MongoDB)

La mise à jour du statut du `Batch` (MongoDB) est protégée par un **Circuit Breaker** Opossum dans le worker :
- si MongoDB devient temporairement instable, le circuit se ferme afin d'éviter d'aggraver la situation
- le worker continue le traitement des jobs sans faire échouer l'ensemble pour une panne passagère
