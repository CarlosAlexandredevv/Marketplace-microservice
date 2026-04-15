# Spec: integração users-service ↔ api-gateway (proxy unificado)

## Contexto

O **users-service** (porta **3000**) já está completo com **registro**, **login JWT**, **proteção de rotas** (guards), e endpoints de consulta (**profile**, **sellers**, **:id**).

O **api-gateway** (porta **3005**) expõe **`/auth/*`** e **`/users/*`**, mas **não** todas essas rotas passam pelo **`ProxyService`**: o **`AuthController`** delega para um **`AuthService`** que usa **`HttpService`** com chamadas HTTP **diretas** ao users-service, **fora** da infraestrutura de **circuit breaker**, **retry**, **timeout** e **fallback**. Esse atalho **oculta erros reais** do backend — por exemplo, **409 Conflict** no registo pode surgir no cliente como **401** genérico com mensagem do tipo *"Registration failed"*.

O padrão correto **já** está aplicado no gateway para o products-service: o **`ProductsProxyController`** em **`api-gateway/src/products-proxy/`** (estrutura equivalente a um módulo “products” no gateway) usa **`ProxyService.proxyRequest()`** para todas as rotas. A infraestrutura de resiliência foi alinhada para **reencaminhar erros 4xx** ao cliente (**sem** retry e **sem** acionar o circuit breaker por **4xx**) — ver implementação em **`ProxyService`**, **`RetryService`** e **`CircuitBreakerService`**.

Esta spec define a **refatoração** necessária no gateway para que **auth** e **users** sigam o **mesmo** padrão de proxy que **products**, **mantendo** os mesmos paths, métodos e comportamento esperado pelo consumidor.

**Não** inclui código neste documento — apenas **o quê** deve ser entregue e verificado, não **como** implementar.

**Fora de escopo desta spec:** **gestão de sessão** (session management); **novos microserviços**; **alteração** dos contratos já existentes de **register**, **login** e endpoints **`/users/*`** no users-service, exceto onde esta spec **exige** novos endpoints ou documentação no próprio users-service (ver RF-01 a RF-03). *(A alteração ao `ProxyService` e serviços de resiliência associados **não** está em “fora de escopo”: esse trabalho **já** foi corrigido no gateway.)*

---

## 1. Requisitos funcionais — users-service

*(RF-01, RF-02 e RF-03 **inalterados** relativamente à spec anterior de integração.)*

### 1.1 `GET /auth/validate-token` (RF-01)

1. O serviço deve expor **`GET /auth/validate-token`** como rota **protegida**, exigindo **token JWT válido** (mesma regra de autenticação das demais rotas não públicas do serviço).
2. Em caso de sucesso (**HTTP 200**), a resposta deve incluir os **dados do utilizador autenticado** necessários para o gateway validar o token de forma consistente com o domínio: pelo menos **`userId`** (ou equivalente semântico ao identificador do utilizador), **`email`** e **`role`**.
3. O propósito declarado deste endpoint é **uso interno** pelo **api-gateway** na **validação de tokens** encaminhados pelo cliente; o contrato deve ser **estável** e **documentado** (ver secção 1.3).

### 1.2 `GET /health` (RF-02)

4. O serviço deve expor **`GET /health`** como rota **pública** (**não** requer autenticação).
5. Em caso de sucesso, a resposta deve ser um JSON com **`status`** igual à string **`"ok"`** e **`service`** igual à string **`"users-service"`** (sem prescrever nomes de campos adicionais além destes dois obrigatórios).
6. O propósito declarado deste endpoint é ser consumido pelo **health check** do **api-gateway** (ou orquestração) para confirmar que o users-service está **acessível** e **identificável**.

### 1.3 Swagger / OpenAPI (RF-03)

7. A documentação automática da API do users-service deve estar **acessível** no caminho **`/api`** (convenção acordada para este serviço).
8. A configuração exposta ao consumidor da documentação deve indicar **título** **"Users Service"** e **versão** **"1.0"**.
9. A documentação deve permitir **autenticação Bearer (JWT)** no Swagger (esquema **Bearer**), de forma que os endpoints protegidos possam ser **testados** interativamente com token.

---

## 2. Requisitos funcionais — api-gateway

### 2.1 Configuração de ambiente

10. O ambiente de desenvolvimento local do gateway deve declarar **`USERS_SERVICE_URL=http://localhost:3000`** no ficheiro **`.env`** (ou equivalente de configuração local adotado pelo repositório), de forma que o proxy **resolva** o users-service na porta correta.

### 2.2 RF-05 — Refatoração: controlador de utilizadores/auth via `ProxyService`

11. Deve existir um **controlador** no gateway (nome sugerido: **`UsersController`** ou alinhado à convenção do repositório, por analogia com **`ProductsProxyController`**) que exponha as rotas **`/auth/*`** e **`/users/*`** **exclusivamente** via **`ProxyService.proxyRequest('users', ...)`**, seguindo o padrão de **`api-gateway/src/products-proxy/products-proxy.controller.ts`** e do módulo correspondente (**`ProductsProxyModule`** / registo no **`AppModule`**).
12. **Rotas públicas** — **`POST /auth/register`**, **`POST /auth/login`**: encaminhar **sem** exigir JWT no gateway (mantendo políticas de **throttle**/validação de DTO já existentes no gateway, se aplicável).
13. **Rotas protegidas** — **`GET /auth/validate-token`**, **`GET /users/profile`**, **`GET /users/sellers`**, **`GET /users/:id`**: aplicar **`@UseGuards(JwtAuthGuard)`** (ou equivalente já usado no gateway), **reencaminhar** o cabeçalho **`Authorization`** e repassar **`userInfo`** (ou payload coerente com o contrato atual do `ProxyService`) como nas rotas **`/users/*`** já proxied com JWT.
14. O **`AuthController`** e o **`AuthService`** do gateway que implementam **login** e **register** via **`HttpService`** direto ao users-service devem ser **eliminados** ou **refatorados** de forma que **deixem** de existir chamadas HTTP paralelas ao proxy para esses fluxos — o fluxo unificado via **`ProxyService`** **substitui** a necessidade dessas chamadas diretas para **auth** e **users** expostas no gateway. *(Componentes do gateway ainda necessários para **validação local de JWT**, estratégia Passport, ou **sessões** se mantidas, podem permanecer noutros serviços/módulos, desde que **não** dupliquem o transporte HTTP ao users-service para as rotas cobertas por esta spec.)*

**Referência obrigatória de padrão:** **`ProductsProxyController`** e **`ProductsProxyModule`** em **`api-gateway/src/products-proxy/`**.

---

## 3. Fluxo completo esperado via gateway (porta 3005)

Todas as interações abaixo assumem o cliente a falar **apenas** com o gateway (**`http://localhost:3005`** ou URL base equivalente), **não** diretamente com o users-service.

| Ordem | Método e caminho no gateway | Comportamento esperado (resumo) |
|-------|------------------------------|----------------------------------|
| 1 | **`POST /auth/register`** | O gateway **proxies** via **`ProxyService`** para o users-service; respostas e erros **preservam** status e corpo do serviço de destino (em especial **4xx**). |
| 2 | **`POST /auth/login`** | Idem; token JWT e erros **coerentes** com o users-service. |
| 3 | **`GET /auth/validate-token`** | O gateway exige JWT; **proxies** para o users-service com **`Authorization`**; resposta alinhada ao RF-01. |
| 4 | **`GET /users/profile`** | O gateway valida o token; **proxies** via **`ProxyService`**; retorna o **perfil** do utilizador autenticado. |
| 5 | **`GET /users/sellers`** | Idem; lista de **sellers**. |
| 6 | **`GET /users/:id`** | Idem; consulta por identificador, conforme contrato do users-service. |

**Compatibilidade:** Os **paths**, **métodos** e **contratos** expostos no gateway para o consumidor **mantêm-se** os já acordados; apenas o **transporte interno** deve passar a ser unificado pelo **`ProxyService`**.

---

## 4. Critérios de aceite (E2E testáveis)

Os critérios abaixo devem ser **executáveis** com **curl**, **Postman** ou ferramenta equivalente, **sempre** usando a **base URL do gateway** (porta **3005**), salvo onde se indica verificação direta ao users-service apenas para health.

1. Com **users-service** e **api-gateway** em execução e **`USERS_SERVICE_URL`** apontando para o users-service, **`GET {gateway}/health`** (ou o endpoint de health global do gateway definido no projeto) reflete **saúde** conforme a implementação existente; e o health do users-service é **atingível** de forma consistente com o uso de **`GET /health`** no users-service (conforme secção 1.2), quando o gateway o consultar.
2. **`GET http://localhost:3000/health`** (users-service) retorna **`status`** **`"ok"`** e **`service`** **`"users-service"`** **sem** cabeçalho de autorização.
3. **`POST /auth/register`** via gateway cria utilizador com sucesso (código e corpo conforme contrato existente).
4. **Registo com email duplicado** via gateway devolve **409 Conflict** (ou o código exato que o users-service emite), **não** um **401** genérico nem mensagem opaca que **oculte** o conflito.
5. **`POST /auth/login`** via gateway devolve token JWT utilizável no cabeçalho **`Authorization: Bearer <token>`** quando as credenciais são válidas.
6. **Login com credenciais inválidas** via gateway devolve **401** **coerente** com o users-service, **incluindo** mensagem/corpo **reais** do backend (preservados pelo proxy), **não** uma resposta genérica que **substitua** o erro de origem.
7. **`GET /users/profile`** via gateway **com** token válido retorna o perfil do utilizador autenticado (**200** conforme serviço).
8. **`GET /users/profile`** via gateway **sem** token ou com token inválido **não** devolve o perfil com sucesso (**401** ou comportamento de negação já definido no gateway).
9. **`GET /users/sellers`** via gateway **com** token válido retorna a lista esperada (**200**).
10. **`GET /auth/validate-token`** via gateway **com** token válido **proxies** corretamente e retorna **200** com **`userId`**, **`email`** e **`role`** (ou equivalente); **sem** token ou com token inválido, negação coerente (**401** ou equivalente).
11. **`GET /auth/validate-token`** no users-service **com** o mesmo token usado no gateway continua a permitir validação direta ao serviço conforme RF-01, quando testado contra a porta **3000**.
12. Erros **4xx** devolvidos pelo users-service (corpo e status) são **reencaminhados** ao cliente através do gateway **sem** distorção introduzida por camadas que **substituam** o erro por outro status genérico.
13. Erros **4xx** **não** devem **acionar** o **circuit breaker** do gateway (comportamento alinhado às correções em **`ProxyService`** / **`CircuitBreakerService`**).
14. A documentação Swagger do users-service está disponível em **`/api`** com título **"Users Service"**, versão **"1.0"**, e **Bearer Auth** configurado para testes.

---

## 5. Dependências e alinhamento

- **Autenticação JWT**, guards e **`@Public()`** no users-service: specs anteriores do repositório (**03**, **05**).
- **Endpoints de utilizadores**: spec **`06-endpoints-consulta-usuarios.md`**.
- **Padrão de proxy no gateway:** **`products-service/docs/specs/05-integracao-products-service-api-gateway.md`** e implementação em **`api-gateway/src/products-proxy/`**.

---

## 6. Entregáveis resumidos

| Área | Entregável |
|------|------------|
| users-service | **`GET /auth/validate-token`** (protegido); **`GET /health`** (público); Swagger em **`/api`** com metadados e Bearer (RF-01 a RF-03). |
| api-gateway | **`.env`** com **`USERS_SERVICE_URL=http://localhost:3000`**; controlador unificado **`/auth/*`** e **`/users/*`** via **`ProxyService.proxyRequest('users', ...)`**; remoção/refatoração de **`AuthController`** / **`AuthService`** que faziam **`HttpService`** direto para esses fluxos. |
| Integração | Fluxo E2E **register → login → profile → sellers** (e **validate-token**, **users/:id** conforme aplicável) via gateway; critérios da secção 4 cumpridos, incluindo preservação de **4xx** e **não** abertura de circuito por **4xx**. |
