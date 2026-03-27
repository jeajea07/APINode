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

## Diagrammes ASCII

Flux Producer / Consumer:
```
Client
  |
  v
API (Express) --(create batch + documents)--> MongoDB
  |
  v
BullMQ (Redis)  <---- jobs "generate-pdf"
  |
  v
Worker (Piscina + PDFKit) --(store PDF)--> GridFS (MongoDB)
```

Sequence de traitement d'un batch:
```
Client -> API: POST /api/documents/batch [ids]
API -> MongoDB: create Batch(status=pending, totalDocuments)
API -> MongoDB: insert Document[] (status=pending)
API -> BullMQ: enqueue jobs (userId, batchId, documentId)
API -> Client: 202 { batchId }

loop polling
  Client -> API: GET /api/documents/batch/:batchId
  API -> MongoDB: read Batch + Documents
  API -> Client: status + documents[]
end

Worker -> BullMQ: consume job
Worker -> MongoDB: update Document(status=processing)
Worker -> Piscina: generate PDF
Worker -> GridFS: store PDF
Worker -> MongoDB: update Document(status=completed|failed)
Worker -> MongoDB: update Batch(processedCount/failedCount, status)
```

## Justification des choix techniques
- BullMQ vs RabbitMQ: BullMQ s'integre nativement avec Node.js, s'appuie sur Redis deja requis, propose la gestion des retries et des jobs facilement, et reduit la complexite d'infra pour un POC ou un test technique.
- GridFS: permet de stocker des PDFs volumineux directement dans MongoDB avec un systeme de chunks robuste, evite un stockage local fragile dans Docker et simplifie la sauvegarde.
- Piscina: thread pool officiel/standard pour Node.js, utilise Worker Threads, permet de paralleliser la generation PDF sans bloquer l'event loop.

## Benchmark (Phase 9)

Commande:
```bash
cd backend
npm run benchmark
```

Rapport (dernier run disponible):
```
=== BENCHMARK REPORT ===
Date           : 2026-03-26T19:06:12.468Z
Durée totale   : 8697ms
Débit moyen    : 115 docs/s
Succès         : 0/1000
Échecs         : 0/1000
Mémoire peak   : 85 MB
```

Note: si le worker n'est pas lance en meme temps que le benchmark, les compteurs restent a 0. Relancer le benchmark avec API + worker actifs pour obtenir un rapport final.

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
Windows (PowerShell):
```powershell
curl.exe -i http://localhost:3000/health
```

Creer un batch (ex: 5 IDs):
```bash
curl -i -X POST http://localhost:3000/api/documents/batch \
  -H "Content-Type: application/json" \
  -d '["id-1","id-2","id-3","id-4","id-5"]'
```
Windows (PowerShell):
```powershell
curl.exe -i -X POST http://localhost:3000/api/documents/batch ^
  -H "Content-Type: application/json" ^
  -d "[\"id-1\",\"id-2\",\"id-3\",\"id-4\",\"id-5\"]"
```

Lire un batch:
```bash
curl -i http://localhost:3000/api/documents/batch/<BATCH_ID>
```
Windows (PowerShell):
```powershell
curl.exe -i http://localhost:3000/api/documents/batch/<BATCH_ID>
```

Telecharger un PDF:
```bash
curl -o document_<DOCUMENT_ID>.pdf http://localhost:3000/api/documents/<DOCUMENT_ID>
```
Windows (PowerShell):
```powershell
curl.exe -o document_<DOCUMENT_ID>.pdf http://localhost:3000/api/documents/<DOCUMENT_ID>
```

Erreurs attendues:
```bash
curl -i http://localhost:3000/api/documents/1
curl -i http://localhost:3000/api/documents/batch/invalid
```
Windows (PowerShell):
```powershell
curl.exe -i http://localhost:3000/api/documents/1
curl.exe -i http://localhost:3000/api/documents/batch/invalid
```

Swagger (doc API):
```bash
curl -i http://localhost:3000/api-docs
```
Windows (PowerShell):
```powershell
curl.exe -i http://localhost:3000/api-docs
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
