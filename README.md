# Batch Monitor Hub

## Acces rapides (apres `docker compose up -d --build`)
- Frontend: http://localhost:8081
- API: http://localhost:3000
- Healthcheck: http://localhost:3000/health

Projet full-stack pour piloter des batches de generation PDF via une API Node/Express, une file Redis (BullMQ) et un worker asynchrone.

## Architecture (resume)
- API Express (MongoDB + Redis)
- Queue BullMQ pour les jobs PDF
- Worker dedie pour la generation PDF
- Frontend React (Vite)

## Demarrage rapide (Docker)

```bash
docker compose up -d
```

URLs:
- Frontend: `http://localhost:8081`
- API: `http://localhost:3000`
- Healthcheck: `GET /health`

## Demarrage en local (dev)

Backend:
```bash
cd backend
cp .env.example .env
npm install
docker compose up -d mongodb redis
npm run dev
```

Optionnel (taille de batch):
```
BATCH_MIN_SIZE=1
BATCH_MAX_SIZE=5000
```

Worker (autre terminal):
```bash
cd backend
npx ts-node src/workers/documentWorker.ts
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

## Tests

Backend:
```bash
cd backend
npm run test
```

Frontend:
```bash
cd frontend
npm run test
```

## Verifications API via curl

Healthcheck:
```bash
curl -i http://localhost:3000/health
```

Creer un batch (ex: 5 IDs):
```bash
curl -i -X POST http://localhost:3000/api/documents/batch \
  -H "Content-Type: application/json" \
  -d '["id-1","id-2","id-3","id-4","id-5"]'
```

Lire un batch:
```bash
curl -i http://localhost:3000/api/documents/batch/<BATCH_ID>
```

Telecharger un PDF:
```bash
curl -o document_<DOCUMENT_ID>.pdf http://localhost:3000/api/documents/<DOCUMENT_ID>
```

Erreurs attendues:
```bash
curl -i http://localhost:3000/api/documents/1
curl -i http://localhost:3000/api/documents/batch/invalid
```

Swagger (doc API):
```bash
curl -i http://localhost:3000/api-docs
```

## Lint

Backend:
```bash
cd backend
npm run lint
```

Frontend:
```bash
cd frontend
npm run lint
```
