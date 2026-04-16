# SPEC: Processamento de Pagamento com Integração AbacatePay

**Serviço:** `payments-service` (porta 3004)  
**Versão:** 1.0.0  
**Status:** Draft  
**Referência API:** [AbacatePay Docs](https://docs.abacatepay.com)

---

## 1. Visão Geral

Esta spec descreve a implementação completa do processamento de pagamento no `payments-service`, substituindo qualquer gateway fictício por uma integração real com a API do **AbacatePay**.

O fluxo é **assíncrono por natureza**: ao consumir uma mensagem de pedido finalizado, o serviço cria uma cobrança no AbacatePay e armazena a referência. A confirmação do pagamento ocorre quando o AbacatePay notifica o serviço via webhook.

### Fluxo Macro

```
checkout-service
    │
    │  publica PaymentOrderMessage
    ▼
RabbitMQ (payment_queue)
    │
    │  consume
    ▼
PaymentConsumerService
    │
    │  chama
    ▼
PaymentsService.processPayment()
    │
    ├─► Cria entidade Payment (status: pending)
    │
    ├─► Chama AbacatePayGatewayService
    │       │
    │       │  PIX → POST /v1/pixQrCode/create
    │       │  CARD/outros → POST /v1/billing/create
    │       │
    │       └─► Retorna { gatewayId, paymentUrl?, brCode?, expiresAt? }
    │
    └─► Salva Payment com gatewayId e dados da cobrança (status: pending)

AbacatePay (webhook PAID)
    │
    ▼
PaymentsController (POST /payments/webhook/abacatepay)
    │
    └─► PaymentsService.handleWebhook() → atualiza status (approved | rejected)
```

---

## 2. Variáveis de Ambiente

As seguintes variáveis devem ser adicionadas ao `.env` do `payments-service`:

| Variável                    | Descrição                                           | Obrigatória |
| --------------------------- | --------------------------------------------------- | ----------- |
| `ABACATEPAY_API_KEY`        | Chave de API Bearer do AbacatePay                   | Sim         |
| `ABACATEPAY_BASE_URL`       | URL base da API (`https://api.abacatepay.com`)      | Sim         |
| `ABACATEPAY_RETURN_URL`     | URL de retorno para o cliente ao clicar em "Voltar" | Sim         |
| `ABACATEPAY_COMPLETION_URL` | URL de redirecionamento após pagamento concluído    | Sim         |
| `ABACATEPAY_WEBHOOK_SECRET` | Segredo para validação da assinatura do webhook     | Sim         |
| `ABACATEPAY_DEV_MODE`       | `true` em ambiente de desenvolvimento               | Não         |

---

## 3. Entidade Payment

### 3.1 Campos

| Campo              | Tipo          | Restrições                  | Descrição                                                   |
| ------------------ | ------------- | --------------------------- | ----------------------------------------------------------- |
| `id`               | UUID          | PK, gerado automaticamente  | Identificador interno                                       |
| `orderId`          | UUID          | NOT NULL, único             | ID do pedido de origem                                      |
| `userId`           | UUID          | NOT NULL                    | ID do usuário comprador                                     |
| `amount`           | decimal(10,2) | NOT NULL                    | Valor do pagamento em reais                                 |
| `status`           | enum          | NOT NULL, default `pending` | Estado atual do pagamento                                   |
| `paymentMethod`    | varchar(50)   | NOT NULL                    | Método de pagamento (`PIX`, `CARD`, etc.)                   |
| `gatewayBillingId` | varchar(255)  | nullable                    | ID da cobrança retornado pelo AbacatePay                    |
| `paymentUrl`       | varchar(500)  | nullable                    | URL de pagamento gerada para cobrança CARD/MULTIPLE         |
| `pixBrCode`        | text          | nullable                    | Código PIX copia-e-cola                                     |
| `pixBrCodeBase64`  | text          | nullable                    | QR Code PIX em base64                                       |
| `pixExpiresAt`     | timestamp     | nullable                    | Data de expiração do QR Code PIX                            |
| `rejectionReason`  | varchar(255)  | nullable                    | Motivo de rejeição informado pelo gateway                   |
| `processedAt`      | timestamp     | nullable                    | Momento em que o status mudou para `approved` ou `rejected` |
| `createdAt`        | timestamp     | NOT NULL                    | Gerado automaticamente                                      |
| `updatedAt`        | timestamp     | NOT NULL                    | Atualizado automaticamente                                  |

### 3.2 Enum PaymentStatus

```
pending   → cobrança criada no gateway, aguardando pagamento do cliente
approved  → pagamento confirmado pelo AbacatePay via webhook
rejected  → pagamento expirado, cancelado ou recusado
```

### 3.3 Índices

- Índice único em `orderId` (uma cobrança por pedido)
- Índice em `gatewayBillingId` (para lookup via webhook)
- Índice em `status` (para queries de monitoramento)

---

## 4. AbacatePayGatewayService

Responsável por toda a comunicação HTTP com a API do AbacatePay. Deve ser um `@Injectable()` NestJS com escopo singleton.

### 4.1 Configuração HTTP

- Autenticação via header `Authorization: Bearer <ABACATEPAY_API_KEY>`
- Base URL configurada via variável de ambiente
- Timeout de 10 segundos por requisição
- Retry automático de até 2 tentativas para erros 5xx (backoff exponencial)
- Toda falha de comunicação deve lançar uma exceção tipada (`GatewayUnavailableException`)

### 4.2 Método: Criar Cobrança PIX

**Endpoint AbacatePay:** `POST /v1/pixQrCode/create`

**Quando usar:** `paymentMethod === 'PIX'`

**Dados de entrada (do PaymentOrderMessage + Payment):**

| Campo AbacatePay   | Origem                                                            |
| ------------------ | ----------------------------------------------------------------- |
| `amount`           | `payment.amount * 100` (converter reais → centavos, inteiro)      |
| `expiresIn`        | `3600` (1 hora, configurável via env `ABACATEPAY_PIX_EXPIRES_IN`) |
| `description`      | `Pedido #<orderId>` (truncar em 37 caracteres)                    |
| `metadata.orderId` | `message.orderId`                                                 |
| `metadata.userId`  | `message.userId`                                                  |

**Dados de retorno esperados:**

| Campo               | Descrição                                                              |
| ------------------- | ---------------------------------------------------------------------- |
| `data.id`           | ID do QR Code PIX (`pix_char_...`) → armazenar como `gatewayBillingId` |
| `data.brCode`       | Código copia-e-cola → `pixBrCode`                                      |
| `data.brCodeBase64` | QR Code em base64 → `pixBrCodeBase64`                                  |
| `data.expiresAt`    | Data de expiração → `pixExpiresAt`                                     |
| `data.status`       | Deve ser `PENDING`                                                     |

### 4.3 Método: Criar Cobrança (CARD / outros métodos)

**Endpoint AbacatePay:** `POST /v1/billing/create`

**Quando usar:** `paymentMethod !== 'PIX'`

**Dados de entrada:**

| Campo AbacatePay   | Origem                                          |
| ------------------ | ----------------------------------------------- |
| `frequency`        | `"ONE_TIME"` (fixo)                             |
| `methods`          | `["CARD"]` ou mapeado do `paymentMethod`        |
| `products`         | Mapeados de `message.items[]` (ver seção 4.3.1) |
| `returnUrl`        | `ABACATEPAY_RETURN_URL`                         |
| `completionUrl`    | `ABACATEPAY_COMPLETION_URL`                     |
| `externalId`       | `message.orderId`                               |
| `metadata.orderId` | `message.orderId`                               |
| `metadata.userId`  | `message.userId`                                |

#### 4.3.1 Mapeamento de Items → Products

Cada item de `message.items[]` deve ser mapeado para o formato de `products` do AbacatePay:

| Campo AbacatePay | Origem                                 |
| ---------------- | -------------------------------------- |
| `externalId`     | `item.id` ou `item.productId`          |
| `name`           | `item.name`                            |
| `description`    | `item.description` (opcional)          |
| `quantity`       | `item.quantity`                        |
| `price`          | `item.price * 100` (centavos, inteiro) |

> **Atenção:** O valor `amount` do pedido como um todo deve bater com a soma de `(price * quantity)` de todos os produtos. Se houver discrepância, logar um aviso mas prosseguir com os itens da mensagem.

**Dados de retorno esperados:**

| Campo         | Descrição                                        |
| ------------- | ------------------------------------------------ |
| `data.id`     | ID da cobrança (`bill_...`) → `gatewayBillingId` |
| `data.url`    | URL de pagamento → `paymentUrl`                  |
| `data.status` | Deve ser `PENDING`                               |

### 4.4 Método: Simular Pagamento (somente dev)

**Endpoint AbacatePay:** `POST /v1/pixQrCode/simulate-payment?id=<pixQrCodeId>`

**Quando usar:** Apenas quando `ABACATEPAY_DEV_MODE=true`, para testes automatizados e smoke tests.

Recebe o `gatewayBillingId` de um pagamento PIX e simula a confirmação de pagamento no ambiente de desenvolvimento do AbacatePay.

### 4.5 Tratamento de Erros do Gateway

| Situação                 | Comportamento                                                           |
| ------------------------ | ----------------------------------------------------------------------- |
| HTTP 401                 | Lançar `GatewayAuthException` — não reprocessar, é erro de configuração |
| HTTP 4xx                 | Lançar `GatewayRequestException` com o body do erro — não reprocessar   |
| HTTP 5xx / timeout       | Lançar `GatewayUnavailableException` — **reprocessável** pelo RabbitMQ  |
| `error !== null` no body | Lançar `GatewayBusinessException` com a mensagem do campo `error`       |

---

## 5. PaymentsService

### 5.1 processPayment(message: PaymentOrderMessage): Promise\<Payment\>

Orquestra o processamento completo de um pagamento. Deve ser **idempotente**: se já existir um `Payment` com o mesmo `orderId`, retornar o existente sem criar duplicata.

**Fluxo:**

1. Verificar se já existe `Payment` com `orderId` da mensagem
   - Se existir e status for `approved` ou `pending`: retornar o existente (idempotência)
   - Se existir e status for `rejected`: logar e retornar o existente (não reprocessar)
2. Criar registro `Payment` com `status: pending` e salvar no banco
3. Chamar `AbacatePayGatewayService`:
   - Se `paymentMethod === 'PIX'`: chamar método de criação de QR Code PIX
   - Caso contrário: chamar método de criação de billing
4. Atualizar o `Payment` com:
   - `gatewayBillingId` retornado
   - `paymentUrl` (se billing CARD)
   - `pixBrCode`, `pixBrCodeBase64`, `pixExpiresAt` (se PIX)
5. Salvar e retornar o `Payment` atualizado

**Em caso de falha no gateway:**

- Se `GatewayUnavailableException`: re-lançar a exceção para o RabbitMQ acionar o mecanismo de retry existente
- Se `GatewayAuthException` ou `GatewayRequestException`: atualizar status para `rejected`, preencher `rejectionReason`, salvar e **não** re-lançar (mensagem não deve ser reprocessada)

### 5.2 handleWebhook(payload: AbacatePayWebhookPayload): Promise\<void\>

Processa a notificação de evento recebida do AbacatePay.

**Fluxo:**

1. Extrair `gatewayBillingId` do payload (campo `data.id`)
2. Buscar `Payment` pelo `gatewayBillingId`
   - Se não encontrar: logar aviso e retornar sem erro (webhook pode ser de outra cobrança)
3. Mapear o status do AbacatePay para o status interno:

| Status AbacatePay | Status interno                                       |
| ----------------- | ---------------------------------------------------- |
| `PAID`            | `approved`                                           |
| `EXPIRED`         | `rejected` (rejectionReason: `"Cobrança expirada"`)  |
| `CANCELLED`       | `rejected` (rejectionReason: `"Cobrança cancelada"`) |

4. Se o status atual já for `approved` ou `rejected`: ignorar (idempotência)
5. Atualizar `status`, `processedAt`, e `rejectionReason` (se aplicável)
6. Salvar

### 5.3 findByOrderId(orderId: string): Promise\<Payment\>

Busca um pagamento pelo `orderId`. Lança `NotFoundException` (HTTP 404) se não encontrado.

---

## 6. PaymentConsumerService

O `TODO` existente no consumer deve ser substituído por uma chamada real ao `PaymentsService.processPayment()`.

**Comportamento após a substituição:**

- Chamar `paymentsService.processPayment(message)`
- Se `GatewayUnavailableException` for propagada, deixar o RabbitMQ tratar com retry e DLQ (comportamento já configurado)
- Se qualquer outro erro ocorrer, logar com nível `error` incluindo `orderId` e stack trace

---

## 7. PaymentsController

### 7.1 GET /payments/:orderId

Consulta o status de um pagamento por `orderId`.

**Response 200:**

```
{
  "id": "uuid",
  "orderId": "uuid",
  "userId": "uuid",
  "amount": 150.00,
  "status": "pending" | "approved" | "rejected",
  "paymentMethod": "PIX",
  "gatewayBillingId": "pix_char_123456",
  "paymentUrl": null,
  "pixBrCode": "00020101...",
  "pixBrCodeBase64": "data:image/png;base64,...",
  "pixExpiresAt": "2025-04-17T12:00:00.000Z",
  "rejectionReason": null,
  "processedAt": null,
  "createdAt": "2025-04-16T11:00:00.000Z",
  "updatedAt": "2025-04-16T11:00:00.000Z"
}
```

**Response 404:** se nenhum pagamento for encontrado para o `orderId`.

### 7.2 POST /payments/webhook/abacatepay

Recebe notificações de eventos de pagamento enviadas pelo AbacatePay.

**Segurança:**

- Validar a assinatura do webhook usando o `ABACATEPAY_WEBHOOK_SECRET`
- Rejeitar requisições com assinatura inválida com HTTP 401
- O mecanismo de validação deve seguir o método documentado pelo AbacatePay (header de assinatura)

**Response 200:** `{ "received": true }` — sempre retornar 200 para eventos processados ou ignorados (para evitar reenvios desnecessários do AbacatePay)

**Response 401:** assinatura inválida

### 7.3 GET /health

Verificação de saúde do serviço. Deve checar:

- Conexão com o banco de dados PostgreSQL
- Conectividade com a API do AbacatePay (`GET /v1/me` ou equivalente)

**Response 200:**

```
{
  "status": "ok",
  "database": "ok",
  "gateway": "ok"
}
```

**Response 503:** se qualquer dependência estiver indisponível.

---

## 8. Módulo AbacatePayModule

Deve ser criado um módulo NestJS dedicado para encapsular a integração com o AbacatePay:

- `AbacatePayModule` — importado pelo `PaymentsModule`
- `AbacatePayGatewayService` — serviço principal de comunicação
- `AbacatePayConfigService` — leitura e validação das variáveis de ambiente do gateway
- O módulo deve ser exportado para permitir uso em outros módulos se necessário

---

## 9. Critérios de Aceite

### CA-01: Criação de cobrança PIX

- Dado que o consumer recebe uma mensagem com `paymentMethod: "PIX"`
- Quando o `processPayment` é chamado
- Então um registro `Payment` com `status: "pending"` deve ser criado no banco
- E o campo `gatewayBillingId` deve conter o ID retornado pelo AbacatePay
- E os campos `pixBrCode` e `pixBrCodeBase64` devem estar preenchidos
- E o campo `pixExpiresAt` deve ser uma data futura

### CA-02: Criação de cobrança CARD

- Dado que o consumer recebe uma mensagem com `paymentMethod: "CARD"`
- Quando o `processPayment` é chamado
- Então um registro `Payment` com `status: "pending"` deve ser criado no banco
- E o campo `paymentUrl` deve conter a URL de pagamento do AbacatePay
- E o campo `gatewayBillingId` deve estar preenchido com o ID `bill_...`

### CA-03: Aprovação via webhook

- Dado que existe um `Payment` com `status: "pending"` e um `gatewayBillingId` válido
- Quando o endpoint `POST /payments/webhook/abacatepay` recebe um evento com `status: "PAID"` e o `data.id` correspondente
- Então o `Payment` deve ter seu `status` atualizado para `"approved"`
- E o campo `processedAt` deve ser preenchido com a data atual

### CA-04: Rejeição via webhook (expirado)

- Dado que existe um `Payment` com `status: "pending"`
- Quando o webhook recebe um evento com `status: "EXPIRED"`
- Então o `Payment` deve ter `status: "rejected"` e `rejectionReason: "Cobrança expirada"`

### CA-05: Consulta por orderId

- Dado que existe um `Payment` para o `orderId` X
- Quando `GET /payments/:orderId` é chamado com o ID X
- Então a resposta deve ter HTTP 200 com todos os campos do pagamento

### CA-06: Consulta inexistente

- Dado que não existe nenhum `Payment` para o `orderId` Y
- Quando `GET /payments/:orderId` é chamado com o ID Y
- Então a resposta deve ter HTTP 404

### CA-07: Idempotência no consumer

- Dado que o consumer recebe a mesma mensagem de `orderId` duas vezes (retry do RabbitMQ)
- Quando `processPayment` é chamado pela segunda vez
- Então nenhuma nova cobrança deve ser criada no AbacatePay
- E o `Payment` existente deve ser retornado sem modificação

### CA-08: Retry em falha de gateway

- Dado que o AbacatePay retorna HTTP 500
- Quando o consumer tenta processar a mensagem
- Então a mensagem deve ser recolocada na fila para retry pelo mecanismo existente
- E nenhum `Payment` deve ter `status: "rejected"` por falha de infraestrutura

### CA-09: Rejeição em erro de configuração

- Dado que a `ABACATEPAY_API_KEY` é inválida (HTTP 401 do gateway)
- Quando o consumer tenta processar a mensagem
- Então o `Payment` deve ser salvo com `status: "rejected"` e `rejectionReason` descritivo
- E a mensagem **não** deve ser recolocada na fila para retry

### CA-10: Segurança do webhook

- Dado que uma requisição chega em `POST /payments/webhook/abacatepay` sem assinatura válida
- Então a resposta deve ser HTTP 401 e nenhum dado deve ser alterado

### CA-11: Health check

- Quando `GET /health` é chamado e todas as dependências estão ok
- Então a resposta deve ser HTTP 200 com `{ status: "ok", database: "ok", gateway: "ok" }`

### CA-12: Simulação em dev mode (somente ambiente de desenvolvimento)

- Dado que `ABACATEPAY_DEV_MODE=true`
- Quando um pagamento PIX é criado e o método de simulação é chamado internamente
- Então o AbacatePay deve confirmar o pagamento no ambiente de desenvolvimento
- E o webhook subsequente deve atualizar o status para `"approved"`

---

## 10. Considerações Arquiteturais

### 10.1 Dados do Cliente

O `PaymentOrderMessage` atual contém apenas `{orderId, userId, amount, items[], paymentMethod}`. A API do AbacatePay aceita cobranças sem dados do cliente (campo `customer` é opcional). As cobranças serão criadas sem vínculo de cliente no AbacatePay, utilizando apenas o `externalId = orderId` para correlação.

> **Decisão futura:** Se for necessário vincular cobranças a clientes no AbacatePay, o `PaymentOrderMessage` deverá ser enriquecido com dados do usuário (name, email, cellphone, taxId) pelo checkout-service antes da publicação na fila.

### 10.2 Conversão de Valores

O AbacatePay trabalha com valores em **centavos (inteiro)**. O serviço deve converter `amount` (reais, decimal) para centavos na fronteira de integração (`Math.round(amount * 100)`). Nenhuma outra parte do sistema deve conhecer esse detalhe.

### 10.3 Fluxo Assíncrono

O status `pending` é o estado esperado após a criação bem-sucedida da cobrança. O cliente precisa acessar a URL de pagamento ou escanear o QR Code para efetuar o pagamento. Não há transição síncrona para `approved` — ela ocorre somente via webhook do AbacatePay.

### 10.4 Endpoints Existentes

Os endpoints de DLQ (`/dlq/*`) e métricas (`/metrics`, `/health`, `/summary`) existentes **não devem ser alterados**. O endpoint `GET /health` desta spec é uma adição ao health check já existente.

---

## 11. Estrutura de Arquivos Esperada

```
payments-service/
└── src/
    ├── payments/
    │   ├── entities/
    │   │   └── payment.entity.ts
    │   ├── dto/
    │   │   └── payment-response.dto.ts
    │   ├── payments.module.ts
    │   ├── payments.service.ts
    │   └── payments.controller.ts
    ├── gateway/
    │   ├── abacatepay/
    │   │   ├── abacatepay.module.ts
    │   │   ├── abacatepay-gateway.service.ts
    │   │   ├── abacatepay-config.service.ts
    │   │   └── dto/
    │   │       ├── create-pix-billing.dto.ts
    │   │       ├── create-card-billing.dto.ts
    │   │       └── abacatepay-webhook.dto.ts
    │   └── exceptions/
    │       ├── gateway-unavailable.exception.ts
    │       ├── gateway-auth.exception.ts
    │       ├── gateway-request.exception.ts
    │       └── gateway-business.exception.ts
    └── consumers/
        └── payment-consumer.service.ts   ← já existente, completar TODO
```
