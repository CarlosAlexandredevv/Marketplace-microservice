# Spec: Finalização de pedido (checkout) e consulta de pedidos do usuário (checkout-service)

| Campo | Valor |
|--------|--------|
| Serviço | checkout-service (porta 3003) |
| Banco | PostgreSQL com TypeORM; entidades `Cart`, `CartItem`, `Order` já existentes |
| Autenticação | JWT; rotas descritas abaixo são **protegidas** (não públicas) |
| Mensageria | RabbitMQ: exchange **`payments`**, routing key **`payment.order`**; fila consumida pelo payments-service: **`payment_queue`** |
| Contrato de mensagem | `PaymentOrderMessage`: `orderId`, `userId`, `amount`, `items[]`, `paymentMethod`, `description?`, `createdAt?` |

## Objetivo

Permitir que um usuário autenticado **finalize o carrinho ativo** transformando-o em um **pedido** (`Order`), com status inicial adequado e publicação assíncrona da ordem de pagamento no RabbitMQ. Permitir também **listar** e **consultar detalhe** dos pedidos **do próprio usuário**, com ordenação e isolamento por titularidade. O processamento efetivo do pagamento permanece **exclusivamente** no payments-service.

## Pré-requisitos assumidos

- O carrinho e os endpoints de gerenciamento de itens já estão disponíveis e coerentes com a spec de carrinho (carrinho ativo por usuário, total derivado dos itens, etc.).
- Existe integração com RabbitMQ e um serviço de aplicação (ex.: `PaymentQueueService`) capaz de **publicar** mensagens no exchange e routing key indicados, com método semanticamente equivalente a **publishPaymentOrder** (ou evolução compatível).
- O modelo `Order` e as relações com `Cart` / usuário permitem persistir: vínculo ao carrinho, total, método de pagamento e status inicial **`pending`** (ou equivalente acordado no domínio), além de `userId` conforme já previsto no esquema.
- Itens do carrinho (`CartItem`) fornecem dados suficientes para montar o array `items` exigido pela mensagem de pagamento (estrutura exata de cada elemento fica para o plano de implementação, desde que o consumidor no payments-service aceite o payload).

## Fora de escopo (explícito)

- **Processamento de pagamento**, confirmação, estorno, webhooks ou qualquer lógica financeira no checkout-service.
- **Cancelamento de pedido** ou alteração de status além do necessário para esta spec (ex.: conclusão do carrinho e criação do pedido `pending`).
- **Verificação de estoque** ou nova validação contra o products-service na finalização.
- Código-fonte, snippets, diagramas de sequência ou escolhas de biblioteca: apenas o **o quê** entregar; o **como** fica para o plano de implementação.

## Convenção de tipagem (obrigatória)

Em todo o código introduzido ou alterado para atender esta spec:

- **Funções** (métodos, handlers, factories, guards auxiliares, etc.) devem ter **tipos de retorno explícitos** sempre que a linguagem permitir inferência insuficiente ou para manter contrato claro; não utilizar retornos implicitamente não tipados onde o projeto já adota tipagem explícita.
- **Variáveis** e **parâmetros** devem ser **tipados** (tipos nomeados, interfaces, tipos utilitários ou genéricos), evitando `any` e evitando omitir anotações onde o padrão do repositório exige clareza de domínio.
- DTOs de entrada/saída, entidades expostas em respostas e estruturas da mensagem RabbitMQ devem refletir tipos **estritos** e **consistentes** com o contrato `PaymentOrderMessage` e com os modelos de domínio.

---

## 1. Requisitos funcionais

### 1.1 Módulo de pedidos (`OrdersModule`)

- Criar (ou consolidar) um **`OrdersModule`** responsável pelos casos de uso de **checkout** e **consulta de pedidos** descritos nesta spec.
- O **`OrdersModule`** deve **importar** explicitamente o **`CartModule`** e o **`EventsModule`** (ou o módulo que exporta o `PaymentQueueService` / publicação RabbitMQ, conforme nomenclatura do projeto — referido aqui como **EventsModule** para alinhar ao enunciado), de forma que os serviços necessários para ler o carrinho e publicar a mensagem estejam disponíveis por injeção onde for definido no plano.
- Registrar controlador(es) e provedor(es) necessários para os endpoints abaixo, sem expor operações fora do escopo.

### 1.2 POST `/cart/checkout` (rota protegida por JWT)

- **Entrada:** corpo da requisição contendo **`paymentMethod`** com valor permitido em um conjunto fixo de literais de negócio: **`credit_card`**, **`debit_card`**, **`pix`**, **`boleto`**. Valores inválidos ou ausentes devem ser rejeitados com erro de validação claro.
- **Pré-condição:** o usuário autenticado possui um carrinho com status **`active`** que **não está vazio** (pelo menos um `CartItem`). Se o carrinho estiver vazio ou não houver carrinho ativo aplicável, a operação não deve criar pedido nem publicar mensagem; deve responder com erro de negócio apropriado (detalhe de status HTTP no plano).
- **Persistência do pedido:** criar um registro **`Order`** associando:
  - **`userId`** do usuário autenticado;
  - **`cartId`** do carrinho que está sendo finalizado;
  - **`total`** igual ao **total do carrinho** no momento da finalização;
  - **`paymentMethod`** conforme enviado na requisição;
  - **`status`** inicial **`pending`**.
- **Transição do carrinho:** após criar o pedido com sucesso, atualizar o carrinho de **`active`** para **`completed`** (ou o valor semântico equivalente já usado no domínio para carrinho encerrado), de modo que não permaneça como carrinho ativo para novas operações de “carrinho atual”.
- **Mensageria:** publicar no RabbitMQ uma mensagem compatível com **`PaymentOrderMessage`**, preenchendo no mínimo: **`orderId`** (identificador do pedido criado), **`userId`**, **`amount`** coerente com o total pago (alinhado ao total do pedido), **`items`** derivados dos itens do carrinho finalizado, **`paymentMethod`** igual ao do pedido. Campos opcionais **`description`** e **`createdAt`** podem ser omitidos ou preenchidos conforme política do plano, desde que o consumidor aceite o payload.
- Utilizar o exchange **`payments`** e a routing key **`payment.order`**, conforme integração existente.
- **Resposta:** retornar a representação do **`Order`** recém-criado (incluindo identificador e status **`pending`**, e demais campos acordados na API), com status HTTP **201 Created**.
- Garantir que falhas após criar o pedido mas antes de publicar (ou o inverso) sejam tratadas conforme estratégia de consistência definida no plano (ex.: transação, compensação, ou idempotência); a spec exige apenas que o comportamento observado pelo cliente seja previsível e documentado nos critérios de aceite complementares do plano se necessário.

### 1.3 GET `/orders` (rota protegida por JWT)

- Retornar **todos os pedidos** cujo **`userId`** seja o do usuário autenticado.
- Ordenação: **do mais recente para o mais antigo** (critério de “data” alinhado ao campo persistido no `Order`, por exemplo data de criação).
- Não retornar pedidos de outros usuários.

### 1.4 GET `/orders/:id` (rota protegida por JWT)

- **`id`** identifica o pedido.
- Retornar o pedido solicitado **somente se** pertencer ao **`userId`** do usuário autenticado.
- Se o pedido não existir **ou** existir mas for de outro usuário, responder com **404 Not Found** (sem vazar existência de pedidos alheios).

### 1.5 Documentação da API

- Incluir os novos endpoints na documentação Swagger/OpenAPI do serviço, com descrição sucinta, enum ou valores permitidos para **`paymentMethod`** no checkout, e indicação de necessidade de JWT.

---

## 2. Regras de negócio

- Um carrinho **`active`** só pode ser finalizado se contiver **pelo menos um item**; o total do pedido reflete o **total do carrinho** no instante da operação.
- Após checkout bem-sucedido, o carrinho associado deixa de estar **`active`** (passa a **`completed`** ou equivalente), alinhado à decisão de não permitir reutilização desse carrinho como “carrinho atual”.
- Pedidos listados e detalhados são **sempre** filtrados pelo usuário autenticado; tentativa de acesso a pedido de terceiro é indistinguível de “não encontrado” (**404**).
- O checkout-service **não** altera estoque nem chama o products-service para esta operação, além do que já existir implicitamente no estado atual do carrinho.

---

## 3. Critérios de aceite (claros e testáveis)

1. **Módulo:** Existe **`OrdersModule`** que importa **`CartModule`** e **`EventsModule`** (ou módulo que exporta a publicação RabbitMQ equivalente), e os endpoints desta spec estão registrados e acessíveis com a proteção JWT aplicada como nas demais rotas protegidas do serviço.
2. **POST `/cart/checkout` — sucesso:** Com JWT válido, carrinho **`active`** com pelo menos um item e `paymentMethod` válido, a resposta é **201** e o corpo contém um pedido com **`status`** `pending`, **`userId`** do token, **`cartId`** do carrinho finalizado, **`total`** igual ao total pré-checkout do carrinho, e **`paymentMethod`** enviado. O carrinho correspondente passa a não estar **`active`** (ex.: **`completed`**).
3. **POST `/cart/checkout` — carrinho vazio:** Com JWT válido e carrinho ativo sem itens (ou sem carrinho ativo com itens, conforme regra unificada no plano), **não** é criado `Order`, **não** é publicada mensagem de pagamento, e a API retorna erro de negócio/validação acordado (não 201).
4. **POST `/cart/checkout` — método inválido:** Corpo sem `paymentMethod` ou com valor fora de `credit_card`, `debit_card`, `pix`, `boleto` resulta em erro de validação; nenhum pedido criado nem mensagem publicada.
5. **RabbitMQ:** Em caso de sucesso do checkout, é publicada uma mensagem no exchange **`payments`** com routing key **`payment.order`**, cujo payload satisfaz o contrato **`PaymentOrderMessage`** (presença de `orderId`, `userId`, `amount`, `items`, `paymentMethod`; opcionais conforme contrato).
6. **GET `/orders`:** Com JWT válido, a lista contém apenas pedidos do usuário do token, ordenados do **mais recente** ao **mais antigo**. Com outro usuário, a lista não inclui pedidos do primeiro.
7. **GET `/orders/:id` — sucesso:** Com JWT válido e `id` de pedido **do mesmo usuário**, retorno **200** com dados do pedido.
8. **GET `/orders/:id` — não autorizado ou inexistente:** `id` inexistente **ou** pedido de outro usuário resulta em **404**.
9. **Tipagem:** Em arquivos tocados pela entrega, revisão estática (e convenção do repositório) confirma que funções, variáveis e parâmetros relevantes estão **tipados** explicitamente conforme seção “Convenção de tipagem”, sem uso de `any` para contornar contratos de domínio.
10. **Escopo:** Não há implementação de captura de pagamento, confirmação de gateway, cancelamento de pedido nem checagem de estoque nesta entrega.

---

## 4. Dependências e integrações

- **Internas:** `CartModule` (leitura/atualização de carrinho e itens), módulo de eventos/mensageria com **`PaymentQueueService`** (ou equivalente) para **publishPaymentOrder**.
- **Externas (assíncronas):** payments-service consome **`payment_queue`**; o checkout-service apenas **publica** conforme contrato acordado.

---

## 5. Notas para o plano de implementação (não normativas)

- Definir granularidade transacional entre persistência do `Order`, atualização do `Cart` e publicação AMQP.
- Definir formato exato de cada elemento em `items` da `PaymentOrderMessage` para alinhar com o consumidor no payments-service.
- Definir DTOs de resposta do `Order` (campos expostos ao cliente) e política para `description` / `createdAt` na mensagem.
