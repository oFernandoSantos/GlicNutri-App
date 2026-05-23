# LibreView Sync

Function preparada para sincronizacao automatica de leituras do LibreView.

## Como funciona

1. O app chama `EXPO_PUBLIC_LIBRE_VIEW_SYNC_URL`
2. Essa URL aponta para a function `libreview-sync`
3. A function repassa `patientId`, `patientEmail` e `limit` para um integrador autorizado
4. O integrador devolve leituras em JSON
5. A function normaliza e retorna no formato esperado pelo app

## Secrets necessarias

Defina nas secrets do Supabase:

- `LIBREVIEW_PROVIDER_URL`
- `LIBREVIEW_PROVIDER_TOKEN`
- `LIBREVIEW_PROVIDER_AUTH_HEADER` (opcional, default `Authorization`)
- `LIBREVIEW_PROVIDER_EXTRA_HEADERS` (opcional, uma linha por header, `Nome: valor`)

## Contrato esperado do provedor

Requisicao `POST`:

```json
{
  "patientId": "uuid-ou-id-interno",
  "patientEmail": "paciente@email.com",
  "limit": 24
}
```

Resposta aceita:

```json
{
  "readings": [
    {
      "value": 118,
      "date": "2026-05-23",
      "time": "08:30:00"
    }
  ]
}
```
```
[
  {
    "valueMgDl": 118,
    "timestamp": "2026-05-23T08:30:00Z"
  }
]
```

Campos reconhecidos pela normalizacao:

- valor: `valueMgDl`, `value_mg_dl`, `value_in_mg_per_dl`, `glucose`, `glucoseMgDl`, `value`
- data/hora: `timestamp`, `dateTime`, `date_time`, `datetime`, `createdAt`, `date`, `time`, `hour`, `hora`
