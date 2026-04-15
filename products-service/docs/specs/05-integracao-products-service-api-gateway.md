# Spec: integração do products-service com api-gateway (fluxo fim a fim)

## Contexto

O **products-service** (porta **3001**) já está funcional com entidade **Product**, autenticação JWT, criação de produto (**`POST /products`**, seller only) e endpoints de consulta (**`GET /products`**, **`GET /products/:id`**, **`GET /products/seller/:sellerId`**).

O **api-gateway** (porta **3005**) já existe com proxy service, circuit breaker, health checks, Swagger e variável **`PRODUCTS_SERVICE_URL=http://localhost:3001`** configurada no ambiente.

A infraestrutura de roteamento **`/products/*`** para o products-service já está presente no gateway. Esta spec define o que falta para consolidar a integração e validar o fluxo completo passando pelo gateway.

**Não** inclui código neste documento — apenas **o quê** deve ser entregue, não **como** implementar.

**Fora de escopo:** alterar mecanismo de proxy do gateway, alterar guards do gateway, refatorar arquitetura dos serviços, criar novos domínios ou alterar contratos de negócio já consolidados no products-service.

---

## 1. Requisitos funcionais no products-service

### 1.1 Endpoint de saúde

1. Deve existir o endpoint **`GET /health`** no products-service.
2. A rota deve ser **pública** (não requer token JWT).
3. A resposta de sucesso deve ser **200 OK** com corpo exatamente no formato:
   - **`status: "ok"`**
   - **`service: "products-service"`**
4. O endpoint deve ser adequado para consumo pelo health check do api-gateway.

### 1.2 Swagger/OpenAPI

1. O products-service deve disponibilizar documentação automática em **`/api`**.
2. O documento OpenAPI deve ter:
   - título **`Products Service`**
   - versão **`1.0`**
3. A documentação deve indicar suporte a autenticação **Bearer Auth** para endpoints protegidos.
4. Endpoints públicos e protegidos devem ficar claramente distinguíveis no Swagger conforme política atual do serviço.

---

## 2. Verificações obrigatórias no api-gateway

1. Confirmar que **`PRODUCTS_SERVICE_URL`** está configurado no **`.env`** do gateway apontando para o products-service em execução.
2. Verificar que o proxy do gateway encaminha corretamente as rotas **`/products/*`** para o products-service, preservando método, path e payload.
3. Verificar que o cabeçalho **`Authorization`** recebido pelo gateway é repassado ao products-service sem perda.
4. Garantir que essa validação respeita o comportamento já existente do gateway, sem alterar o mecanismo de proxy nem os guards.

---

## 3. Fluxo completo esperado via gateway (porta 3005)

1. **`POST /auth/login`** no gateway encaminha para users-service e retorna JWT válido.
2. Com token válido, **`POST /products`** no gateway é repassado ao products-service e resulta em criação de produto conforme regras já existentes (somente seller).
3. **`GET /products`** no gateway é repassado ao products-service e retorna catálogo.
4. **`GET /products/:id`** no gateway é repassado ao products-service e retorna produto por identificador.
5. O fluxo deve ser consistente de ponta a ponta, com respostas HTTP coerentes com as regras dos serviços de destino.

---

## 4. Critérios de aceite (E2E via gateway)

1. O endpoint **`GET /health`** do products-service está funcional e utilizável pelo health check do gateway.
2. O Swagger do products-service está acessível em **`/api`**, com título **Products Service**, versão **1.0** e Bearer Auth documentado.
3. O gateway consegue autenticar usuário via **`POST /auth/login`** e retornar token JWT utilizável no fluxo seguinte.
4. Requisições **`POST /products`** enviadas ao gateway com **`Authorization: Bearer <token>`** chegam ao products-service com o mesmo cabeçalho e criam produto quando o usuário é seller.
5. Requisições **`GET /products`** e **`GET /products/:id`** feitas ao gateway retornam os dados esperados do products-service.
6. Todo o fluxo pode ser validado manualmente por **curl** ou **Postman**, passando exclusivamente pelo gateway na porta **3005**.

---

## 5. Evidências esperadas para validação

1. Evidência de sucesso do login via gateway com retorno de token JWT.
2. Evidência de criação de produto via gateway usando token retornado no login.
3. Evidência de listagem e consulta por ID via gateway com retorno consistente com os dados criados.
4. Evidência de disponibilidade do **`/health`** do products-service e da documentação em **`/api`**.

As evidências podem ser coletadas por execução manual (curl/Postman) e registradas no plano de implementação/testes.

---

## 6. Dependências e rastreabilidade

- **Depende de:** specs anteriores do products-service (scaffold, JWT, criação de produto e consultas), infraestrutura já existente do api-gateway, users-service para emissão de JWT.
- **Complementa:** consolidação da integração entre serviços para permitir testes E2E centralizados no gateway.
