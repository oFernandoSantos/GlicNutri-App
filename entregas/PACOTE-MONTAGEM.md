# Montagem do pacote final (ZIP + anexos)

Objetivo: juntar **código**, **evidências** e **artefatos ML** para a entrega académica sem duplicar `node_modules` nem credenciais.

## 1) ZIP do código (recomendado: `git archive`)

Na raiz do repositório Git (`GlicNutri/`):

```powershell
.\scripts\build-zip-entrega.ps1
```

Saída típica: `entregas/pacote-zip/GlicNutri-repositorio-YYYYMMDD.zip` (só ficheiros **versionados** no Git).

**Incluir manualmente no ZIP da disciplina** (se o professor exigir e não estiver no Git):

- `machine-learning/data/glicnutri_patient_day_export.csv` (gerado localmente; por defeito **não** é versionado — ver `machine-learning/data/.gitignore`).
- Capturas adicionais (CRUD, validações, painel admin) além das já em `entregas/bento/semana-2-auditoria/prints/`.

## 2) Checklist de conteúdo

| Item | Onde |
|------|------|
| Código-fonte | ZIP via script ou pasta completa sem `node_modules` |
| Evidências (prints) | `entregas/bento/semana-2-auditoria/prints/` + novos prints conforme `CRUD-VALIDACOES-ROTEIRO-EVIDENCIAS.md` |
| Manifest ML | `machine-learning/data/export_manifest.json` |
| Artefactos ML | `machine-learning/api/artifacts/*.joblib`, `training_meta.json` |
| Documento Word / PDF | Versão final do TCC + `WordFinalGlicNutri-ATUALIZADO.docx` se usarem o suplemento |
| Slides | Roteiro: `entregas/slides-roteiro.md` → exportar para `.pptx` |

## 3) Documentos de apoio no repo

- Checklist geral: [`PACOTE-FINAL-CHECKLIST.md`](PACOTE-FINAL-CHECKLIST.md)
- Ensaio: [`ENSAIO-FINAL-CHECKLIST.md`](ENSAIO-FINAL-CHECKLIST.md)
- LGPD (colar no Word): [`LGPD-TEXTO-CURTO.md`](LGPD-TEXTO-CURTO.md)
