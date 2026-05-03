# Semana 2 — evidências de auditoria (GlicNutri)

**Data de referência:** maio/2026  
**Estado:** **PARCIAL** — implementação e texto de evidências alinhados à execução real; **falta versionar no Git** os sete PNG referenciados em [`evidencias-auditoria.md`](evidencias-auditoria.md) para fechar a evidência visual no repositório.

## O que está nesta pasta

| Ficheiro | Conteúdo |
|----------|----------|
| [`checklist-auditoria.md`](checklist-auditoria.md) | Cobertura `registrarLogAuditoria` ↔ telas/serviços |
| [`evidencias-auditoria.md`](evidencias-auditoria.md) | Execução real (metadados) + referências `./prints/*.png` |
| [`roteiro-testes.md`](roteiro-testes.md) | Passos executáveis + resultados contra código |
| [`prints/`](prints/) | **Alvo:** 7 PNG (`login_tela`, `login_sucesso`, `glicemia_input`, `glicemia_salva`, `auditoria_app`, `storage_lista`, `storage_log`). Até lá podem existir SVG antigos. |

## Para “fechar” a evidência académica no repo

1. Copiar para `prints/` os PNG capturados no app e no Supabase (nomes acima).
2. Opcional: remover SVG legados após confirmar pré-visualização do Markdown.
3. Opcional: vídeo curto do fluxo Nutricionista → Paciente ou Admin → Auditoria.

Ver também [`ml/EXPORT_CSV.md`](../../../ml/EXPORT_CSV.md) para o export CSV reprodutível (Semana 2 ML).
