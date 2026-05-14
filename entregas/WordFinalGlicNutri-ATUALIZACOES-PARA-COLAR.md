# Atualizações para o Word — GlicNutri (`WordFinalGlicNutri.docx`)

Foi gerado **`WordFinalGlicNutri-ATUALIZADO.docx`** na raiz do projeto: contém **todo o documento original** mais um **suplemento** ao final (nova página) com implementação, stack, ML, Bento, LGPD e diagrama ER.

Use este ficheiro Markdown para **substituir no Word** trechos do corpo (Resumo, Abstract, Conclusão) onde ainda consta apenas «especificação» sem mencionar o protótipo implementado.

---

## 1. Capa / identificação

- Corrigir junção de nomes: **«MATEUS HILBERATH COSTAGUSTAVO RIBEIRO»** → **Mateus Hilberath Costa** e **Gustavo Ribeiro** (duas linhas ou vírgula entre Costa e Gustavo).
- Se a defesa for em 2026, alinhar **CURITIBA – PR** e o **ano** (2025 → 2026) onde fizer sentido institucional.

---

## 2. Resumo (substituir o parágrafo principal + fecho)

**Texto sugerido (substituir o parágrafo que começa com «O Diabetes Mellitus…» até antes de «Palavras-chave»):**

O Diabetes Mellitus (DM) configura um grave desafio de saúde pública, cuja gestão é dificultada pela lacuna entre os dados de monitoramento glicémico e sua aplicação prática no acompanhamento nutricional. O processo atual, frequentemente manual e assíncrono, impede ajustes dietéticos ágeis. Este trabalho aborda esta lacuna ao propor e **materializar** a plataforma digital **GlicNutri**. O objetivo geral consistiu em **desenvolver** um sistema computacional que ofereça suporte a pacientes diabéticos através da integração entre o registro e acompanhamento de glicemia, refeições e medicação, e o acompanhamento nutricional personalizado e remoto. Adotou-se pesquisa aplicada e engenharia de software, com **ciclos de especificação, implementação e evidências** (modelagem, protótipo funcional em Expo/React Native, persistência no Supabase, **pipeline de aprendizado de máquina** com exportação paciente-dia, treino de modelos e **API FastAPI** com predição, além de integração na app para demonstração). Como resultados, apresentam-se os artefatos de modelagem (BPMN, UML, DER e dicionário de dados) **e** a implementação com **auditoria, relatórios no painel administrativo e módulo de ML**. Conclui-se que a GlicNutri tem potencial para apoiar o cuidado proativo; como perspetiva futura, recomenda-se validação clínica amostral e eventual integração formal com dispositivos CGM conforme regulamentação.

**Palavras-chave (opcional, acrescentar uma):** Aprendizado de máquina. Interoperabilidade.

---

## 3. Abstract (equivalente em inglês)

**Suggested replacement paragraph:**

Diabetes Mellitus (DM) is a major public health challenge, and care is often hindered by the gap between glucose monitoring data and practical nutritional follow-up. This work proposes and **implements** the **GlicNutri** digital platform to reduce this gap. The general objective was to **develop** a computational system that supports diabetic patients by integrating glucose, meal and medication records with personalized, remote nutritional care. We followed an applied software engineering approach, combining specification artifacts (BPMN, UML, ER, data dictionary) with a **functional prototype** (Expo/React Native, Supabase), a **machine learning pipeline** (patient-day dataset export, Jupyter notebooks, scikit-learn models, **FastAPI** `/predict`), and **admin auditing/logging**. Results include both the engineering models and a runnable system with reporting and ML demonstration. Future work should include broader clinical validation and regulated CGM interoperability where applicable.

**Keywords (optional):** Machine learning. Cloud backend.

---

## 4. Objetivo geral (secção 1.2.1) — alinhar à implementação

**Substituir por:**

Desenvolver a plataforma digital **GlicNutri**, com aplicação para paciente, nutricionista e administrador, integrando registro e visualização de dados de saúde, plano alimentar e consultas, **com conformidade a boas práticas de privacidade e auditoria**, e **módulo de apoio à decisão baseado em ML** (API de predição), permitindo acompanhamento nutricional remoto.

---

## 5. Objetivos específicos — ajustes pontuais

- Onde está «integração **automática** dos dados do sensor FreeStyle Libre»: se a integração direta com o Libre **não** estiver concluída no código, prefira: «**compatibilizar** o desenho do sistema com integração futura a sensores CGM, mantendo registro manual e agregações no Supabase».
- Corrigir typo: **«EDesenvolver»** → **«Desenvolver»**.

---

## 6. Secção 2.9.1 — alinhar título ao sumário

O sumário menciona «**Tecnologias utilizadas**». No corpo, o título está como «**Entre os principais tipos de sistemas integrados estão**». **Opção A:** renomear o subtítulo do corpo para **«2.9.1 Tecnologias e tipos de sistemas integrados»** e manter os três blocos (gestão clínica, monitoramento digital, nuvem). **Opção B:** atualizar o sumário para refletir o título atual.

Acrescentar parágrafo técnico:

**«Na implementação atual, o front-end utiliza Expo/React Native; o back-end de dados e autenticação utiliza Supabase (PostgreSQL); o módulo de ML utiliza Python (scikit-learn, Jupyter) e FastAPI para servir os modelos treinados.»**

---

## 7. Conclusão — substituir o último parágrafo («Como trabalhos futuros…»)

**Substituir por:**

Como trabalhos futuros, recomenda-se **estudo de usabilidade e validação em campo** com amostra de pacientes e nutricionistas, **mensuração de impacto** em indicadores glicémicos e eventual **integração certificada** com fabricantes de CGM. Do ponto de vista técnico, a etapa de **implementação de referência** (app, banco, auditoria, ML e API) encontra-se **disponível no repositório** do projeto, servindo de base para evolução e para as entregas das disciplinas associadas.

---

## 8. Referências / datas

- Onde citar «Acesso em: 28 ago. **2025**», atualizar para a data real de consulta em **2026** se aplicável.

---

## Ficheiros de apoio no repositório

| Tema | Caminho |
|------|---------|
| Checklist 13 requisitos Bento | `entregas/bento/checklist-13-requisitos-bento.md` |
| ML / Thayse | `entregas/thayse/RESUMO-ENTREGA-ML.md` |
| ER / BD | `entregas/bento/BANCO-DE-DADOS-ER-EVIDENCIAS.md`, `entregas/diagrama-glicnutri-a4-vertical.pdf` |
| Planeamento | `Planejamento_Final_Atividades_GlicNutri_Ajustado.md` |
