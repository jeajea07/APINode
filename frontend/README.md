# Batch Monitor Hub (Frontend)

Interface de suivi des batches de generation PDF.

## Demarrage (dev)

```bash
npm install
npm run dev
```

Par defaut, l'app attend l'API sur `http://localhost:3000`.
Pour changer l'URL:

```bash
VITE_API_BASE_URL=http://localhost:3000 npm run dev
```

## Limites de batch (optionnel)

```bash
VITE_BATCH_MIN=1 VITE_BATCH_MAX=5000 npm run dev
```

## Tests

```bash
npm run test
```
