# GlicNutri

Monorepo: **Expo na raiz desta pasta** (`App.js`, `src/`, `package.json`), **`supabase/`**, **`machine-learning/`** (pipeline + API Python).

## App React Native (Expo)

Na pasta **`GlicNutri/`** (onde está `app.json` e `package.json`):

```bash
npm install
npx expo start
```

Ou: `npm start` (equivale a `expo start`).

## Sincronizacao LibreView

O projeto agora possui 2 pecas preparadas para sincronizacao automatica:

- `machine-learning/api/app/main.py`
  Endpoint `POST /libreview/sync`
- `supabase/functions/libreview-sync`
  Proxy server-side para o app

Fluxo:

1. App chama a Function `libreview-sync`
2. A Function chama o middleware/servidor
3. O middleware chama o provedor real do LibreView
4. As leituras voltam normalizadas para o app

Para ativar em producao ainda e necessario configurar a URL/token do provedor real do LibreView.

## Outras pastas

| Pasta | Função |
|-------|--------|
| `supabase/` | Migrations, Edge Functions |
| `machine-learning/` | Notebooks, dados, export CSV, API FastAPI em `machine-learning/api/` |
| `entregas/` | Evidências académicas |
| `scripts/doc-export/` | PDF do planejamento (opcional) |

Ver também [`../README.md`](../README.md) na raiz do repositório.
