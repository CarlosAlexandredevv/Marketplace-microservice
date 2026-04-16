# Spec: Gerenciamento de carrinho e cliente HTTP do products-service (checkout-service)

| Campo | Valor |
|--------|--------|
| Serviço | checkout-service (porta 3003) |
| Banco | PostgreSQL (porta 5436), TypeORM com entidades `Cart`, `CartItem`, `Order` já existentes |
| Autenticação | JWT global com `@Public()` onde aplicável; `req.user` com `id` (sub), `email` e `role` |
| Integrações | RabbitMQ já presente; **nova** integração HTTP com **products-service** (porta 3001) |

## Objetivo

Permitir que usuários autenticados (**buyers** e **sellers**) gerenciem o **carrinho ativo**: adicionar itens com validação contra o catálogo remoto, consultar o carrinho e remover itens. Introduzir um **cliente HTTP** dedicado ao products-service, configurado por variável de ambiente. Garantir consistência de negócio (um carrinho ativo por usuário, snapshot de preço e nome, total derivado dos subtotais, isolamento por `userId`).

## Pré-requisitos assumidos

- O products-service expõe endpoint **público** **GET** `/products/:id` retornando dados do produto incluindo, no mínimo: identificador, nome, preço, estoque, indicador de ativo (`isActive`) e `sellerId`.
- O checkout-service possui `PRODUCTS_SERVICE_URL` definido no `.env` (e documentado no `.env.example`), apontando para a base URL do products-service (sem path final do recurso individual; a composição do path fica a cargo da implementação).
- O modelo de dados local já prevê `Cart` com `status`, `total` e relação com `CartItem`; `CartItem` com `productId`, `productName`, `price`, `quantity`, `subtotal`.

## Fora de escopo (explícito)

- **Checkout / finalização de pedido** (criação de `Order`, pagamento, esvaziar carrinho por conclusão de compra): spec futura.
- **Endpoint para alterar quantidade de um item existente**; a simplificação acordada é: o usuário **remove** o item e **adiciona** novamente com a quantidade desejada.
- Código-fonte, diagramas de sequência ou escolhas de biblioteca neste documento: apenas o **o quê** entregar; o **como** fica para o plano de implementação.

---

## 1. Requisitos funcionais

### 1.1 ProductsClientService (comunicação HTTP com products-service)

- Disponibilizar um serviço de aplicação responsável por obter dados de produto no products-service.
- Expor operação de leitura por identificador de produto (equivalente semântico a **getProduct(productId)**), que obtém o recurso via requisição HTTP **GET** `/products/:id` em relação à URL base configurada.
- Utilizar o **HttpModule** do ecossistema NestJS baseado em **Axios** (`@nestjs/axios`), registrado de forma adequada ao módulo que hospeda o carrinho ou a um módulo de integração dedicado.
- A URL base do products-service deve ser obtida da variável de ambiente **`PRODUCTS_SERVICE_URL`** (via mecanismo de configuração já adotado no serviço, por exemplo `ConfigService`).
- Comportamento esperado quando o produto não existir no products-service ou quando a chamada HTTP falhar: o sistema deve responder com erro de negócio ou de integração de forma consistente (detalhes de status HTTP e corpo ficam para o plano de implementação), sem persistir item inválido.

### 1.2 POST /cart/items (rota protegida por JWT)

- **Entrada:** corpo com `productId` (UUID) e `quantity` (inteiro **maior ou igual a 1**). Requisições com quantidade inválida ou identificador inválido devem ser rejeitadas com erro de validação claro.
- **Validação remota:** antes de persistir, consultar o products-service através do cliente HTTP para garantir que o produto **existe** e está **ativo** (`isActive` verdadeiro). Se inativo ou inexistente, não adicionar ao carrinho e retornar erro apropriado.
- **Carrinho ativo:** garantir que o usuário autenticado possua no máximo um carrinho com status `active`. Se não existir carrinho ativo, criar um conforme regras de negócio; se já existir, reutilizar esse carrinho.
- **Item já presente:** se já existir linha de `CartItem` no mesmo carrinho para o mesmo `productId`, **somar** a `quantity` recebida à quantidade já armazenada, recalcular o **subtotal** desse item e em seguida recalcular o **total** do carrinho.
- **Novo item:** persistir novo `CartItem` com **snapshot** de `productName` e `price` conforme retorno atual do products-service no momento da adição; `subtotal` = preço unitário × quantidade (após merge, usar a quantidade total do item).
- **Total do carrinho:** após qualquer alteração, `Cart.total` deve refletir a **soma de todos os subtotais** dos itens daquele carrinho.
- **Resposta:** retornar representação do **carrinho completo** (metadados do carrinho, lista de itens com campos relevantes incluindo subtotais, e total). O formato exato (DTOs) fica para a implementação.

### 1.3 GET /cart (rota protegida por JWT)

- Retornar o carrinho **ativo** do usuário autenticado, com itens e total coerentes com a persistência.
- Se o usuário **não** possuir carrinho ativo, retornar uma resposta que represente **carrinho vazio** (por exemplo total zero e lista de itens vazia), sem erro de “não encontrado” que confunda com falha de sistema — o critério é: experiência previsível de “carrinho vazio”.
- Não expor carrinhos de outros usuários.

### 1.4 DELETE /cart/items/:itemId (rota protegida por JWT)

- **itemId** identifica o `CartItem` a remover.
- Remover apenas se o item pertencer ao carrinho ativo do **próprio** usuário autenticado. Se o item não existir, não pertencer ao usuário ou não estiver no carrinho ativo, retornar erro apropriado (ex.: não encontrado ou proibido), sem alterar outros dados.
- Após remoção, **recalcular** o `total` do carrinho como soma dos subtotais dos itens restantes.
- **Resposta:** carrinho atualizado (mesma ideia de completude que no POST).

### 1.5 Documentação e descoberta da API

- Incluir os novos endpoints na documentação Swagger/OpenAPI já prevista no bootstrap do serviço, com descrição sucinta e indicativo de necessidade de JWT, alinhado ao padrão do projeto.

---

## 2. Regras de negócio

- Cada usuário tem **no máximo um** carrinho com status **`active`** por vez.
- **Preço** e **nome do produto** armazenados em `CartItem` são **snapshot** no momento da adição (ou do incremento de quantidade do mesmo produto): refletem o valor obtido na consulta ao products-service naquela operação; não é exigido nesta spec sincronizar automaticamente com mudanças futuras no catálogo.
- **Total** do carrinho = soma aritmética dos **subtotais** de todos os itens do carrinho.
- **Isolamento:** toda leitura e mutação de carrinho/itens deve restringir-se ao `userId` derivado do JWT (`req.user`); vendedores e compradores seguem as mesmas regras de posse do carrinho (qualquer papel autenticado pode ter carrinho ativo).
- Papéis adicionais (ex.: bloquear seller de comprar) **não** fazem parte desta spec salvo requisito futuro.

---

## 3. Critérios de aceite (claros e testáveis)

1. **Cliente HTTP:** Existe um serviço injetável que obtém produto por ID via **GET** na API do products-service, usando base URL de **`PRODUCTS_SERVICE_URL`**, com **HttpModule** (`@nestjs/axios`) integrado ao grafo de módulos do Nest.
2. **POST /cart/items — sucesso:** Com JWT válido, envio de `productId` existente e ativo e `quantity` ≥ 1 resulta em **201** ou **200** (conforme convenção escolhida no plano), corpo com carrinho contendo o item, `subtotal` do item = preço × quantidade (ou quantidade total após merge), e `total` = soma dos subtotais.
3. **POST /cart/items — merge:** Duas adições sucessivas do mesmo `productId` no mesmo carrinho produzem **um** `CartItem` com quantidade somada e subtotal/total recalculados corretamente.
4. **POST /cart/items — produto inativo:** Produto com `isActive` falso não é persistido; resposta de erro adequada (ex.: 400 ou 422) e carrinho inalterado em relação a esse item.
5. **POST /cart/items — produto inexistente:** Identificador inexistente no products-service não cria item; erro adequado (ex.: 404 da API de checkout ou mapeamento explícito documentado).
6. **POST /cart/items — validação:** `quantity` menor que 1 ou `productId` malformado resulta em **400** (ou equivalente de validação) sem efeitos colaterais no banco.
7. **GET /cart — vazio:** Usuário sem carrinho ativo recebe resposta interpretável como carrinho vazio (total zero, sem itens), status **200**.
8. **GET /cart — preenchido:** Usuário com carrinho ativo e itens recebe todos os itens e total correto; outro usuário com outro JWT não vê esses dados.
9. **DELETE /cart/items/:itemId:** Remoção de item do próprio carrinho ativo remove o registro, recalcula `total` e retorna carrinho atualizado; tentativa de remover item de outro usuário ou item inexistente não altera dados alheios e retorna erro apropriado.
10. **Unicidade active:** Para um mesmo `userId`, operações concorrentes ou sequenciais não deixam mais de um carrinho `active` (validável por teste de integração ou inspeção de dados após fluxo de teste).
11. **Snapshot:** Após adicionar item, `productName` e `price` em `CartItem` coincidem com o payload retornado pelo products-service naquela chamada (teste com mock ou stub do HTTP client).
12. **Autenticação:** As três rotas de carrinho **não** aceitam requisição sem JWT válido (**401**).

---

## 4. Entregáveis da implementação (resumo)

- Módulo(s) e providers necessários para `ProductsClientService`, endpoints REST descritos, regras de negócio e persistência TypeORM alinhadas a esta spec, testes automatizados cobrindo ao menos os critérios 2, 4, 7, 8, 9 e 12 (ou conjunto equivalente acordado no plano).
- Nenhuma funcionalidade de checkout ou alteração de quantidade via PATCH/PUT dedicado.

---

*Documento de especificação — implementação delegada a plano subsequente.*
