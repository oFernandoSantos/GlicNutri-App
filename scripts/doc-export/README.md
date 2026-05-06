# Exportação PDF do planejamento

Gera `Planejamento_Final_Atividades_GlicNutri_Ajustado.pdf` a partir do `.md` na raiz de `GlicNutri/`, usando CSS de impressão desta pasta e Microsoft Edge em modo headless.

```powershell
cd GlicNutri
pip install markdown
python scripts/doc-export/_md_to_pdf_once.py
```

Requer Edge instalado no Windows nos caminhos predefinidos no script.
