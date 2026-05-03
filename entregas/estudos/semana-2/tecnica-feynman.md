# Técnica Feynman — Auditoria no GlicNutri

## Conceito em uma frase

A auditoria aqui é um **diário oficial do aplicativo**: cada ação importante gera um bilhete (arquivo JSON) num cofre (bucket `audit-logs`), dizendo **quem** fez, **o quê**, **quando** e se **deu certo**.

## Analogia simples

Imagine um caderno na portaria do prédio. Quando alguém entra (login), registra uma refeição ou altera dados, o porteiro anota a data e o tipo de visita. Esse caderno não é a sala onde moram os dados médicos; é só o registro de movimentação.

## Por que não guardar senha no bilhete?

Porque o bilhete pode ser lido por quem tem acesso ao cofre (políticas do Storage). Senha e token são como chaves mestras: nunca se escrevem no caderno da portaria.

## O que mudou na prática

- **Login:** agora o caderno registra sucesso ou falha (sem revelar a senha digitada).
- **Refeição IA:** registra que houve um “create” com totais numéricos, não a foto nem cada alimento linha a linha.
- **Admin:** o papel “porteiro VIP” aparece como tipo **admin**, para filtrar eventos administrativos.

## Como explicar em 30 segundes na banca

“Guardamos evidência de operações em JSON no Storage do Supabase, separado das tabelas clínicas. Se o upload falha, o paciente continua usando o app; se funciona, o administrador vê a trilha na tela de Auditoria.”
