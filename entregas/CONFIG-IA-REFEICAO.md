# Configuracao — IA de refeicao por foto (Gemini + TACO)

A analise de foto usa **Google Gemini Vision** na Edge Function `analisar-refeicao-ia` e **TACO** no app para macros brasileiros.

**OpenAI foi removida** deste fluxo.

## Fluxo

1. Paciente tira foto → upload no bucket `refeicoes-ia`
2. Edge Function envia imagem ao **Gemini** (especialista em fotos de comida; padrao: `gemini-2.0-flash`, retry automatico se falhar)
3. IA retorna alimentos + gramas estimadas em JSON
4. App refina macros com tabela TACO
5. Paciente revisa e salva

Alternativa sem IA: **Anexar foto sem IA** + busca manual na TACO.

---

## Passo a passo (configuracao)

### 1. Criar chave no Google AI Studio

1. Acesse [aistudio.google.com](https://aistudio.google.com)
2. Entre com sua conta Google
3. Menu **Get API key** → **Create API key**
4. Copie a chave (formato `AIza...`)

Plano gratuito tem limites diarios; para testes do GlicNutri costuma bastar.

### 2. Configurar secret no Supabase

1. [supabase.com/dashboard](https://supabase.com/dashboard) → projeto **GlicNutri**
2. **Edge Functions** → **Secrets**
3. **Remova** (se existirem): `OPENAI_API_KEY`, `OPENAI_VISION_MODEL`
4. **Adicione**:
   - `GEMINI_API_KEY` = sua chave `AIza...`
   - `GEMINI_API_KEY_FALLBACK` = segunda chave `AIza...` (opcional; outra conta Google se a primeira estourar cota)
   - `GEMINI_VISION_MODEL` = `gemini-2.0-flash-lite` (opcional; padrao no codigo: lite → flash → 2.5)
   - **Nao** use `gemini-1.5-flash` (descontinuado na API) nem `gpt-4o-mini`

### 3. Publicar a Edge Function

No PowerShell, na pasta do projeto:

```powershell
cd "C:\Users\flima\OneDrive\Área de Trabalho\GlicNutri-App\GlicNutri"
npx supabase login
npx supabase link --project-ref isiweqkdoyxorohuibqb
npx supabase secrets set GEMINI_API_KEY=AIzaSUA_CHAVE_AQUI
npx supabase functions deploy analisar-refeicao-ia
```

Substitua `AIzaSUA_CHAVE_AQUI` pela chave real.

### 4. Testar no app

```powershell
npx expo start -c
```

1. Login paciente
2. **Registrar Refeição** → foto → **Analisar com IA**
3. Deve listar alimentos (ex.: biscoito) sem erro de OpenAI/quota

---

## Secrets obrigatorios

| Secret | Obrigatorio | Valor |
|--------|-------------|--------|
| `GEMINI_API_KEY` | Sim | Chave `AIza...` do Google AI Studio |
| `GEMINI_VISION_MODEL` | Nao | `gemini-2.0-flash` (padrao no codigo) |
| `SUPABASE_URL` | Sim | (ja no projeto) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | (ja no projeto) |

**Nunca** coloque `GEMINI_API_KEY` no app React Native nem no `.env` do Expo.

---

## Troubleshooting

| Erro | Acao |
|------|------|
| `gemini-1.5-flash is not found` | Troque secret para `gemini-2.0-flash` e deploy da function |
| `GEMINI_API_KEY invalida` | Criar chave em aistudio.google.com e salvar no Supabase |
| `API key not valid` | Chave errada ou API Generative Language nao habilitada |
| `Resource exhausted` / quota | Deploy da function atualizada; aguardar reset; `GEMINI_API_KEY_FALLBACK`; billing no AI Studio; no app use chips TACO |
| Nao identificou alimentos | Outra foto, mais luz, ou TACO manual |
| Function not found | `npx supabase functions deploy analisar-refeicao-ia` |

---

## Custo

- Google AI Studio: tier gratuito com limites (consulte [ai.google.dev/pricing](https://ai.google.dev/pricing))
- Nao usa ChatGPT Plus nem creditos OpenAI

---

## Limite atingido (quota) — como aumentar de verdade

O app **nao consegue** subir o teto da API sozinho. Quem define limite e **Google**, por chave e por plano.

### O que NAO aumenta limite

- Mudar codigo do GlicNutri ou Supabase
- Rodar `deploy` de novo (so atualiza a function, nao a cota)
- Colocar a mesma chave em outro lugar

### O que AUMENTA limite (escolha 1 ou combine)

| Opcao | O que fazer | Efeito |
|-------|-------------|--------|
| **1. Esperar reset** | Gratuito costuma resetar por minuto/hora/dia (veja no [AI Studio](https://aistudio.google.com)) | Volta a funcionar sem pagar |
| **2. Segunda chave (gratis)** | Outra conta Google → nova chave → Supabase secret `GEMINI_API_KEY_FALLBACK` | Dobro de cota gratuita no projeto |
| **3. Billing (pago)** | [Google AI Studio](https://aistudio.google.com) → plano / billing, ou [Google Cloud Console](https://console.cloud.google.com) → ativar faturamento no projeto da API → Generative Language API | Limites **muito maiores**; paga por uso (centavos por foto em geral) |
| **4. Modelo mais leve** | Secret `GEMINI_VISION_MODEL=gemini-2.0-flash-lite` | Consome menos cota por chamada (qualidade um pouco menor) |

### Passo a passo — billing (limite maior, recomendado para producao)

1. Acesse [aistudio.google.com](https://aistudio.google.com) com a conta da chave atual
2. Menu **Settings** / **Plan** (ou link de upgrade / billing)
3. Associe forma de pagamento (cartao) ao projeto Google Cloud da API
4. Confirme que a **Generative Language API** esta ativa no [Cloud Console](https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com)
5. **Nao e obrigatorio** trocar a chave: a mesma `AIza...` passa a usar limites do plano pago
6. No Supabase, mantenha `GEMINI_API_KEY` e rode deploy se alterou secrets:

```powershell
npx supabase functions deploy analisar-refeicao-ia
```

### Passo a passo — segunda chave gratis (rapido)

1. Conta Google **diferente** (ou outro e-mail)
2. Nova chave em AI Studio
3. Supabase → Edge Functions → Secrets:

```
GEMINI_API_KEY_FALLBACK=AIza...SEGUNDA_CHAVE
```

4. Deploy da function (acima)

O codigo ja alterna: esgota a principal → tenta a fallback.

### Enquanto a cota estiver zerada no app

- Botao unico **Identificar alimentos na foto** (fluxo inteligente)
- Se Gemini falhar → **modo TACO** automatico (sem erro vermelho, sem limite)
- Chips por tipo de refeicao (almoco, cafe, lanche)
- Link **So guardar a foto** para preenchimento 100% manual

---

## Experiencia facilitada para o paciente (implementado no app)

| Camada | Limite? | Papel |
|--------|---------|--------|
| **TACO + chips** | Nao | Sempre funciona; foto salva; usuario toca o que comeu |
| **Gemini (nuvem)** | Sim (Google) | Extra: tenta reconhecer sozinho quando ha cota |

Fluxo: foto → **Identificar alimentos na foto** → tenta IA → se limite/erro → abre atalhos TACO (foto ja salva).

Para o paciente parecer **sem limite**: use modo TACO (padrao quando IA cai) + billing na chave do **dono do app** (todos os pacientes compartilham uma cota paga grande).

### Producao — “sem limite” para todos os usuarios

1. Uma conta Google do **projeto GlicNutri** com **billing ativo**
2. `GEMINI_API_KEY` + opcional `GEMINI_API_KEY_FALLBACK` no Supabase
3. Custo por foto baixo; limite alto o suficiente para centenas de pacientes/dia

O app nao cobra do paciente; o limite e do servidor, nao do celular.

### Referencia oficial de limites

- [ai.google.dev/pricing](https://ai.google.dev/pricing)
- [ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)
