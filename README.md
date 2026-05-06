# GlicNutri

Monorepo: **Expo na raiz desta pasta** (`App.js`, `src/`, `package.json`), **`supabase/`**, **`machine-learning/`** (pipeline + API Python).

## App React Native (Expo)

Na pasta **`GlicNutri/`** (onde está `app.json` e `package.json`):

```bash
npm install
npx expo start
```

Ou: `npm start` (equivale a `expo start`).

## Outras pastas

| Pasta | Função |
|-------|--------|
| `supabase/` | Migrations, Edge Functions |
| `machine-learning/` | Notebooks, dados, export CSV, API FastAPI em `machine-learning/api/` |
| `entregas/` | Evidências académicas |
| `scripts/doc-export/` | PDF do planejamento (opcional) |

Ver também [`../README.md`](../README.md) na raiz do repositório.
