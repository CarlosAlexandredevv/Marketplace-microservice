# Spec: integração do checkout-service no api-gateway

## Contexto

O `checkout-service` (porta `3003`) já expõe endpoints funcionais e protegidos por JWT para operações de carrinho e pedidos:

- `POST /cart/items`
- `GET /cart`
- `DELETE /cart/items/:itemId`
- `POST /cart/checkout`
- `GET /orders`
- `GET /orders/:id`

O `api-gateway` (porta `3005`) já possui base de proxy reutilizável com:

- `ProxyModule` e `ProxyService` com circuit breaker, retry, timeout e fallback;
- `AuthModule` com `JwtAuthGuard`;
- controllers de proxy já implementados para `users-service` e `products-service`;
- `gateway.config.ts` com `checkout` configurado (`url: http://localhost:3003`, `timeout: 10000`);
- suporte do `ProxyService` para `serviceName` igual a `checkout`, inclusive com fallback.

Esta especificação cobre somente a exposição das rotas de carrinho e pedidos via `api-gateway`, reaproveitando a infraestrutura existente.

**Fora de escopo desta spec:**

- alterar o mecanismo de proxy existente no gateway;
- alterar comportamento, contrato ou implementação do `checkout-service`;
- criar rotas relacionadas a pagamentos (`payments`), que serão tratadas em outra spec.

---

## 1. Requisitos funcionais

1. **Criar `CheckoutModule` no gateway**  
   Deve existir um módulo dedicado à integração com o `checkout-service`, contendo dois controllers de proxy: um para carrinho e outro para pedidos/finalização.

2. **Criar `CartProxyController`**  
   O controller deve estar sob `@Controller('cart')` e protegido com `@UseGuards(JwtAuthGuard)`.  
   Deve expor os seguintes contratos no gateway:
   - `POST /cart/items` -> proxy para `checkout-service` em `POST /cart/items`;
   - `GET /cart` -> proxy para `checkout-service` em `GET /cart`;
   - `DELETE /cart/items/:itemId` -> proxy para `checkout-service` em `DELETE /cart/items/:itemId`.

3. **Criar `OrdersProxyController`**  
   O controller deve estar protegido com `@UseGuards(JwtAuthGuard)`.  
   Deve expor os seguintes contratos no gateway:
   - `POST /cart/checkout` -> proxy para `checkout-service` em `POST /cart/checkout`;
   - `GET /orders` -> proxy para `checkout-service` em `GET /orders`;
   - `GET /orders/:id` -> proxy para `checkout-service` em `GET /orders/:id`.

4. **Registrar `CheckoutModule` no `AppModule` do gateway**  
   O módulo precisa ser carregado pela aplicação para que as rotas fiquem disponíveis na porta do `api-gateway`.

---

## 2. Requisitos de segurança e propagação de contexto

1. **Proteção por JWT no gateway**  
   Todas as rotas de proxy desta spec devem exigir autenticação via `JwtAuthGuard`.

2. **Repasse obrigatório de `Authorization`**  
   Todos os proxies de carrinho e pedidos devem encaminhar o header `Authorization` recebido no gateway para o `checkout-service`, preservando o token enviado pelo cliente.

---

## 3. Requisitos de testes E2E (fluxo completo via gateway)

Deve existir cobertura E2E exercitando o fluxo principal de ponta a ponta, passando exclusivamente pelo `api-gateway`:

1. autenticar usuário (login) para obter JWT válido;
2. adicionar item ao carrinho;
3. consultar carrinho;
4. finalizar checkout;
5. consultar lista de pedidos.

O cenário deve validar que as chamadas passam pelas rotas do gateway e que o token é aceito ao longo de todo o fluxo protegido.

---

## 4. Critérios de aceite (claros e testáveis)

1. O `api-gateway` expõe as rotas `POST /cart/items`, `GET /cart` e `DELETE /cart/items/:itemId` por meio de `CartProxyController` protegido por JWT.

2. O `api-gateway` expõe as rotas `POST /cart/checkout`, `GET /orders` e `GET /orders/:id` por meio de `OrdersProxyController` protegido por JWT.

3. Todas as rotas desta spec encaminham requisições para o `checkout-service` usando a configuração já existente de `checkout` no gateway.

4. Todas as rotas desta spec repassam o header `Authorization` ao `checkout-service` sem removê-lo ou substituí-lo.

5. O `CheckoutModule` está registrado no `AppModule` do gateway e as rotas ficam acessíveis quando a aplicação sobe na porta `3005`.

6. Existe teste E2E cobrindo o fluxo completo via gateway: login -> add to cart -> view cart -> checkout -> view orders.

7. Não há criação de rotas de `payments` e não há alteração no mecanismo atual de proxy nem no `checkout-service`.

---

## 5. Rastreabilidade

- Depende de: infraestrutura já existente de proxy e autenticação no `api-gateway` e endpoints já funcionais no `checkout-service`.
- Complementa: especificações anteriores de integração do gateway com outros serviços.
- Prepara terreno para: specs futuras de integração com pagamentos.
