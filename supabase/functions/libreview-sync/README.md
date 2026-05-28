# LibreView Sync

Function para sincronizacao automatica de leituras do LibreView / LibreLinkUp.

## Como funciona

1. O app chama `EXPO_PUBLIC_LIBRE_VIEW_SYNC_URL`
2. Essa URL aponta para a function `libreview-sync`
3. Se o app enviar `libreEmail` e `librePassword`, a function autentica direto no LibreLinkUp (API nao oficial)
4. Se nao houver credenciais, a function repassa para `LIBREVIEW_PROVIDER_URL` (integrador externo)
5. A function normaliza e retorna leituras no formato esperado pelo app

## Secrets opcionais (modo provedor externo)

- `LIBREVIEW_PROVIDER_URL`
- `LIBREVIEW_PROVIDER_TOKEN`
- `LIBREVIEW_PROVIDER_AUTH_HEADER` (opcional, default `Authorization`)
- `LIBREVIEW_PROVIDER_EXTRA_HEADERS` (opcional, uma linha por header, `Nome: valor`)

## Requisicao direta LibreLinkUp

```json
{
  "patientId": "uuid-do-paciente",
  "limit": 48,
  "libreEmail": "conta@email.com",
  "librePassword": "senha-librelinkup",
  "libreRegion": "la"
}
```

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
