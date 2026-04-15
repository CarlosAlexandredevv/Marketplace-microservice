# Correção de infraestrutura: portas PostgreSQL e teste do checkout-service

## Contexto

No monorepo **marketplace-ms**, cada serviço possui PostgreSQL dedicado. Havia conflito de porta entre **products-service** e **checkout-service** (ambos em **5434** no host), impedindo subir os dois bancos ao mesmo tempo. Além disso, o **payments-service** podia ter `DB_PORT` desalinhado entre `.env` e `docker-compose`. O teste unitário do `AppController` do **checkout-service** falhava por falta de provider para `PaymentQueueService` após essa dependência ser adicionada ao controller.

**Escopo:** apenas **checkout-service** e **payments-service**. Não alterar **users-service** nem **products-service**. Não criar `docker-compose` na raiz nem novos Dockerfiles.

## Mapeamento de portas (host) — referência

| Serviço           | Porta PostgreSQL (host) |
|-------------------|-------------------------|
| users-service     | 5433                    |
| products-service  | 5434                    |
| checkout-service  | **5436** |
| payments-service  | 5435                    |

## 1. Checkout-service — porta do banco **5434 → 5436**

Alterar em:

1. **`checkout-service/docker-compose.yml`** — mapeamento `ports` do serviço do Postgres (ex.: `5436:5432`).
2. **`checkout-service/.env`** — quando existir localmente, `DB_PORT=5436` (arquivo costuma estar no `.gitignore`; o template versionado é `.env.example`).
3. **`checkout-service/.env.example`** — `DB_PORT=5436`.
4. **`checkout-service/src/config/database.config.ts`** — fallback numérico quando `process.env.DB_PORT` não estiver definido: **5436**.

## 2. Payments-service — alinhar `DB_PORT` com o Docker

1. **`payments-service/.env`** — `DB_PORT=5435`, consistente com **`payments-service/docker-compose.yml`** (`"5435:5432"`).
2. Manter **`payments-service/.env.example`** com `DB_PORT=5435` como referência para novos clones.

## 3. Checkout-service — teste `app.controller.spec.ts`

O `AppController` injeta `PaymentQueueService`. O `TestingModule` deve registrar um **mock** de `PaymentQueueService` (por exemplo `useValue` com `jest.fn()` nos métodos públicos usados pelo controller, ou um stub mínimo), além de `AppService`, para o módulo compilar e o teste de `getHello()` passar.

## 4. Critérios de aceite (testáveis)

1. **Portas:** Com `docker compose` do **checkout-service** e do **products-service** ativos, não há erro de “port already allocated” no host para Postgres — checkout usa **5436**, products usa **5434**.
2. **Checkout config:** Com `DB_PORT` ausente no ambiente, o fallback em `database.config.ts` é **5436** (valor padrão no código).
3. **Payments:** Com o container do payments-db na porta publicada **5435**, um cliente configurado com `DB_HOST=localhost` e `DB_PORT=5435` consegue conectar (alinhado ao compose).
4. **Testes:** `npm test` (ou `npm run test`) no **checkout-service** executa sem falha, incluindo `app.controller.spec.ts`.
5. **Não-regressão:** Nenhuma alteração em **users-service** ou **products-service**; nenhum novo `docker-compose` na raiz do repositório.

## Implementação realizada

- Porta checkout: `docker-compose.yml`, `.env.example`, `database.config.ts`.
- Payments: `.env.example` e `.env` local quando aplicável com `DB_PORT=5435`.
- Teste: mock de `PaymentQueueService` em `src/app.controller.spec.ts`; `AppController` declara a dependência coerente com o módulo de eventos.
