# SPEC: Correção de infraestrutura — portas PostgreSQL (checkout/payments) e teste do AppController (checkout-service)

## Contexto

No **marketplace-ms**, quatro serviços usam PostgreSQL dedicado no host:

| Serviço | Porta PostgreSQL (host) |
|--------|-------------------------|
| users-service | 5433 |
| products-service | 5434 |
| checkout-service | **5436** (não pode colidir com products em 5434) |
| payments-service | 5435 |

**Problemas tratados:**

1. **Conflito de porta:** `checkout-service` e `products-service` não podem publicar o Postgres no mesmo host em **5434**; o checkout deve usar **5436**.
2. **Inconsistência payments:** `DB_PORT` no `.env` do payments-service deve ser **5435**, alinhado ao mapeamento `"5435:5432"` em `docker-compose.yml`.
3. **Teste quebrado:** `app.controller.spec.ts` do checkout-service falha se o `AppController` injeta `PaymentQueueService` sem provider/mock no `TestingModule`.

**Restrições:** não alterar **users-service** nem **products-service**. Não criar `docker-compose` na raiz nem novos Dockerfiles. Os arquivos reais de compose nos serviços são `docker-compose.yml` (não há `docker-compose.yaml`).

**Nota sobre `.env`:** em geral `.env` está no `.gitignore`; a fonte versionada para novos clones é `.env.example`. Desenvolvedores devem manter `DB_PORT` local coerente com o compose.

---

## 1. Correção do checkout-service (porta do banco **5434 → 5436**)

Alterar a porta do PostgreSQL **no host** para **5436** de forma consistente em:

1. **`checkout-service/docker-compose.yml`** — mapeamento `ports` do serviço do banco (ex.: `'5436:5432'`).
2. **`checkout-service/.env`** — `DB_PORT=5436` (ambiente local; copiar/ajustar a partir de `.env.example` se necessário).
3. **`checkout-service/.env.example`** — `DB_PORT=5436` como referência versionada.
4. **`checkout-service/src/config/database.config.ts`** — fallback quando `process.env.DB_PORT` não define um valor válido: porta padrão **5436** (por exemplo `Number(process.env.DB_PORT) || 5436`, tratando `NaN` como inválido se a equipe padronizar assim).

---

## 2. Correção do payments-service (alinhar `DB_PORT` ao Docker)

1. **`payments-service/.env`** — definir **`DB_PORT=5435`**, consistente com **`payments-service/docker-compose.yml`** (`"5435:5432"`).
2. Manter **`payments-service/.env.example`** com **`DB_PORT=5435`** para onboarding e CI local.

---

## 3. Correção do teste do checkout-service (`app.controller.spec.ts`)

O `AppController` depende de `PaymentQueueService`. No `TestingModule` de **`checkout-service/src/app.controller.spec.ts`**:

- Registrar **`PaymentQueueService`** com **`useValue`** (ou equivalente), expondo mocks **`jest.fn()`** para os métodos usados pelo controller (no mínimo os públicos que o controller possa invocar direta ou indiretamente; tipicamente `publishPaymentOrder` e `publishPaymentOrderSafe` conforme o serviço real).
- Manter **`AppService`** (e demais providers exigidos pelo controller) para o módulo compilar.

Objetivo: o teste existente de `getHello()` (e quaisquer outros no mesmo arquivo) executam sem erro de injeção do Nest.

---

## 4. Critérios de aceite (claros e testáveis)

1. **Sem colisão de porta:** Com `docker compose` do **checkout-service** e do **products-service** ativos, o host não apresenta conflito de bind na mesma porta para os dois Postgres — checkout em **5436**, products em **5434**.
2. **Fallback checkout:** Com variável `DB_PORT` ausente ou inválida conforme a convenção do projeto, a aplicação checkout usa porta padrão **5436** definida em `database.config.ts`.
3. **Payments alinhado:** Com o container do payments-db publicado em **5435**, a aplicação payments-service conecta com `DB_HOST=localhost` e `DB_PORT=5435` (coerente com compose e `.env` / `.env.example`).
4. **Testes unitários checkout:** Em `checkout-service`, `npm test` (ou o script `test` do `package.json`) conclui com sucesso, incluindo **`src/app.controller.spec.ts`**.
5. **Escopo:** Diff sem alterações em **users-service** ou **products-service**; sem novos compose/Dockerfile na raiz do monorepo.

---

## Estado esperado no repositório após implementação

- Checkout: compose em **5436**, `.env.example` e fallback em `database.config.ts` em **5436**.
- Payments: `DB_PORT` **5435** em `.env.example` e ambiente local.
- Teste: mock de `PaymentQueueService` presente no `TestingModule` de `app.controller.spec.ts`.
