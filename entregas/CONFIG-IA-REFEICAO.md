# Configuracao — IA de refeicao por foto (OpenAI + TACO)

A analise de foto usa **OpenAI Vision** na Edge Function `analisar-refeicao-ia` e **TACO** no app para macros brasileiros.

**Google Gemini foi removido** deste fluxo.

## Fluxo

1. Paciente tira foto → upload no bucket `refeicoes-ia`
2. Edge Function envia imagem ao **OpenAI** (`gpt-4o-mini` por padrao; fallback `gpt-4o`)
3. IA retorna alimentos + gramas estimadas em JSON
4. App refina macros com tabela TACO
5. Paciente revisa e salva

Alternativa sem IA: **Anexar foto sem IA** + busca manual na TACO.

---

## Passo a passo — comprar creditos OpenAI (tokens)

### 1. Criar conta OpenAI

1. Acesse [platform.openai.com](https://platform.openai.com)
2. Crie conta ou entre com e-mail/Google
3. Confirme telefone se a plataforma pedir

### 2. Adicionar forma de pagamento (obrigatorio para uso continuo)

1. Menu **Settings** (engrenagem) → **Billing**
2. **Payment methods** → adicione cartao de credito
3. Em **Billing** → **Add to credit balance** (pre-pago) ou ative **Auto-recharge**
   - Recomendado para testes: **US$ 10–20** de saldo inicial
   - Para piloto com varios pacientes: **US$ 50+** e auto-recarga quando cair de **US$ 5**

Sem saldo/cartao, a API retorna erro de quota (`insufficient_quota`).

### 3. Criar API Key

1. **API keys** → [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. **Create new secret key**
3. Nome: `GlicNutri-producao` (ou `GlicNutri-dev`)
4. Copie a chave (`sk-proj-...`) — **so aparece uma vez**

Guarde em gerenciador de senhas. Nunca commite no Git.

### 4. Escolher modelo (custo x qualidade)

| Modelo | Uso | Custo aproximado |
|--------|-----|------------------|
| `gpt-4o-mini` | Padrao no GlicNutri — bom custo | ~US$ 0,15 / 1M tokens entrada + imagem barata |
| `gpt-4o` | Mais preciso em pratos complexos | Mais caro; use se mini errar muito |

No Supabase (opcional): secret `OPENAI_VISION_MODEL` = `gpt-4o` para maxima precisao.

Estimativa: **~200–400 fotos/mes** com `gpt-4o-mini` costumam ficar **abaixo de US$ 5** (varia com tamanho da imagem).

### 5. Limites e uso 100% estavel

1. **Usage limits**: Settings → **Limits** — defina **monthly budget** (ex.: US$ 30) para nao estourar
2. **Usage**: monitore em **Usage** → Vision / Chat Completions
3. Mantenha saldo > US$ 1 na conta
4. Publique a function apos configurar secrets (passo 6)

### 6. Configurar secrets no Supabase

1. [supabase.com/dashboard](https://supabase.com/dashboard) → projeto **GlicNutri**
2. **Edge Functions** → **Secrets**
3. **Remova** (se existirem): `GEMINI_API_KEY`, `GEMINI_API_KEY_FALLBACK`, `GEMINI_VISION_MODEL`
4. **Adicione**:
   - `OPENAI_API_KEY` = `sk-proj-SUA_CHAVE`
   - `OPENAI_VISION_MODEL` = `gpt-4o-mini` (opcional; padrao no codigo)
   - Para maxima precisao: `OPENAI_VISION_MODEL` = `gpt-4o`

### 7. Publicar a Edge Function

**Atalho no Windows (recomendado):** script que pede a chave só no seu terminal:

```powershell
cd "C:\Users\flima\OneDrive\Área de Trabalho\GlicNutri-App\GlicNutri"
npx supabase login
powershell -ExecutionPolicy Bypass -File .\scripts\configurar-openai-supabase.ps1
npx supabase functions deploy analisar-refeicao-ia
```

`login` e `secrets` sao **comandos separados**. No `login`, pressione apenas **Enter** e aguarde o navegador — nao cole outros comandos na mesma tela (erro `failed to scan line: expected newline`).

No cmd/PowerShell, evite aspas na chave: use `OPENAI_API_KEY=sk-proj-...` sem `"..."`.

Project ref deste repo: `isiweqkdoyxorohuibqb` (ja em `supabase/config.toml`).

Manual:

```powershell
cd "C:\Users\flima\OneDrive\Área de Trabalho\GlicNutri-App\GlicNutri"
npx supabase login
npx supabase secrets set OPENAI_API_KEY=sk-proj-SUA_CHAVE_AQUI
npx supabase secrets set OPENAI_VISION_MODEL=gpt-4o-mini
npx supabase functions deploy analisar-refeicao-ia
```

### 8. Testar no app

1. Login como paciente
2. Registrar refeicao com IA → tirar foto ou galeria
3. Aguarde lista de alimentos
4. Se falhar: mensagem indica quota, chave ou rede — use logs da function no Supabase

---

## Troubleshooting

| Erro | Acao |
|------|------|
| `OPENAI_API_KEY invalida` | Secret errada ou nao deployada |
| `insufficient_quota` / 429 | Adicionar creditos em Billing |
| `IA_NOT_CONFIGURED` | Secret ausente — repita passo 6–7 |
| Nenhum alimento | Foto escura/angulo ruim; tente `gpt-4o` ou TACO manual |

---

## Seguranca

- Chave **somente** em Supabase Secrets (servidor)
- App chama `supabase.functions.invoke('analisar-refeicao-ia')` — chave nunca no celular
- Rotacione a key se vazar
