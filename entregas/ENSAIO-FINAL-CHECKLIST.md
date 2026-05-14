# Ensaio final — checklist (antes de enviar / apresentar)

Executar na ordem; marcar `[x]` quando concluído na vossa cópia local.

## 1. Ambiente

- [ ] Node/npm instalados; na raiz do projeto `npm install` (se necessário).
- [ ] Python 3 com dependências da API: `pip install -r machine-learning/api/requirements.txt` (ou ambiente virtual do grupo).

## 2. API de Machine Learning

Na pasta `machine-learning/api/`:

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001
```

- [ ] `GET http://127.0.0.1:8001/health` responde OK (navegador ou `Invoke-WebRequest`).
- [ ] `POST http://127.0.0.1:8001/predict` com JSON de exemplo (ver `entregas/thayse/RESUMO-ENTREGA-ML.md`) responde sem erro.

## 3. Aplicação (Expo)

Na raiz do projeto:

```powershell
npm run start
```

- [ ] Login paciente (ou conta de teste) funciona.
- [ ] Navegação até registo de glicemia ou monitoramento sem erro grave.
- [ ] **Previsão (IA)** / «Previsão (Machine Learning)»: URL da API aponta para `http://127.0.0.1:8001` (ou IP da máquina na rede local para dispositivo físico); chamada mostra resultado.

## 4. Demonstração gravada (se vídeo for entregue)

- [ ] Roteiro de `entregas/PACOTE-FINAL-CHECKLIST.md` §3 seguido (login → home → registo → admin se aplicável → ML).
- [ ] Áudio e resolução legíveis; duração dentro do limite da disciplina.

## 5. Pacote ZIP

- [ ] Corrido `scripts/build-zip-entrega.ps1` (ou instruções em `entregas/PACOTE-MONTAGEM.md`).
- [ ] Pasta de evidências e `export_manifest.json` incluídos conforme exigência do professor.

**Última revisão:** consolidado com `entregas/PACOTE-FINAL-CHECKLIST.md`.
