# Spec: integração users-service ↔ api-gateway (marketplace-ms)

## Contexto

O **users-service** (porta **3000**) já está completo com **registro**, **login JWT**, **proteção de rotas** (guards), e endpoints de consulta (**profile**, **sellers**, **:id**).

O **api-gateway** (porta **3005**) já existe e possui **proxy** com **circuit breaker**, **retry** e **timeout**; **guards** de autenticação (**JWT** e **Session**); **health checks**; **Swagger**; e configuração para **`USERS_SERVICE_URL`** via variável de ambiente. A infraestrutura para rotear requisições **`/auth/*`** e **`/users/*`** para o users-service **já está prevista**.

Esta spec define o que falta **finalizar** para a integração ser **completa** e o fluxo **ponta a ponta** ser **validável** através do gateway, **sem** alterar o **mecanismo** de proxy ou de guards do gateway (considerados **corretos e imutáveis** neste escopo).

**Fora de escopo desta spec:** **gestão de sessão** (session management); **refatoração** ou **mudança de comportamento** do proxy, circuit breaker, retry, timeout ou guards do gateway além da **verificação** descrita abaixo; **novos microserviços**; **alteração** dos contratos já existentes de **register**, **login** e endpoints **`/users/*`** no users-service, exceto onde esta spec **exige** novos endpoints ou documentação.

**Não** inclui código neste documento — apenas **o quê** deve ser entregue e verificado, não **como** implementar.

---

## 1. Requisitos funcionais — users-service

### 1.1 `GET /auth/validate-token`

1. O serviço deve expor **`GET /auth/validate-token`** como rota **protegida**, exigindo **token JWT válido** (mesma regra de autenticação das demais rotas não públicas do serviço).
2. Em caso de sucesso (**HTTP 200**), a resposta deve incluir os **dados do usuário autenticado** necessários para o gateway validar o token de forma consistente com o domínio: pelo menos **`userId`** (ou equivalente semântico ao identificador do usuário), **`email`** e **`role`**.
3. O propósito declarado deste endpoint é **uso interno** pelo **api-gateway** na **validação de tokens** encaminhados pelo cliente; o contrato deve ser **estável** e **documentado** (ver secção 1.3).

### 1.2 `GET /health`

4. O serviço deve expor **`GET /health`** como rota **pública** (**não** requer autenticação).
5. Em caso de sucesso, a resposta deve ser um JSON com **`status`** igual à string **`"ok"`** e **`service`** igual à string **`"users-service"`** (sem prescrever nomes de campos adicionais além destes dois obrigatórios).
6. O propósito declarado deste endpoint é ser consumido pelo **health check** do **api-gateway** (ou orquestração) para confirmar que o users-service está **acessível** e **identificável**.

### 1.3 Swagger / OpenAPI

7. A documentação automática da API do users-service deve estar **acessível** no caminho **`/api`** (convenção acordada para este serviço).
8. A configuração exposta ao consumidor da documentação deve indicar **título** **"Users Service"** e **versão** **"1.0"**.
9. A documentação deve permitir **autenticação Bearer (JWT)** no Swagger (esquema **Bearer**), de forma que os endpoints protegidos possam ser **testados** interativamente com token.

---

## 2. Requisitos funcionais — api-gateway

### 2.1 Configuração de ambiente

10. O ambiente de desenvolvimento local do gateway deve declarar **`USERS_SERVICE_URL=http://localhost:3000`** no ficheiro **`.env`** (ou equivalente de configuração local adotado pelo repositório), de forma que o proxy **resolva** o users-service na porta correta.

### 2.2 Proxy e cabeçalhos (verificação, sem alterar mecanismo)

11. Deve ser **verificado** (teste manual ou automatizado conforme prática do projeto) que o proxy **encaminha** corretamente as rotas com prefixo **`/auth/*`** e **`/users/*`** para o destino configurado em **`USERS_SERVICE_URL`**, preservando método HTTP e caminho esperados pelo users-service.
12. Deve ser **verificado** que o cabeçalho **`Authorization`** enviado pelo cliente ao gateway é **repassado** nas requisições **proxied** ao users-service quando aplicável (para que login, rotas protegidas e **`GET /auth/validate-token`** recebam o token).

**Restrição explícita:** **não** alterar a **implementação** do mecanismo de proxy nem dos guards do gateway; apenas **garantir configuração** e **comprovar comportamento** conforme acima.

---

## 3. Fluxo completo esperado via gateway (porta 3005)

Todas as interações abaixo assumem o cliente a falar **apenas** com o gateway (**`http://localhost:3005`** ou URL base equivalente), **não** diretamente com o users-service.

| Ordem | Método e caminho no gateway | Comportamento esperado (resumo) |
|-------|------------------------------|----------------------------------|
| 1 | **`POST /auth/register`** | O gateway **proxies** para o users-service; o utilizador fica **registado** conforme contrato já existente do serviço. |
| 2 | **`POST /auth/login`** | O gateway **proxies** para o users-service; a resposta inclui **token JWT** utilizável nas chamadas seguintes (conforme contrato já existente). |
| 3 | **`GET /users/profile`** | O gateway **valida** o token (fluxo JWT já existente no gateway, podendo usar **`GET /auth/validate-token`** no users-service quando aplicável à arquitetura atual); após validação bem-sucedida, **proxies** para o users-service; retorna o **perfil** do utilizador autenticado. |
| 4 | **`GET /users/sellers`** | O gateway **valida** o token; **proxies** para o users-service; retorna a **lista de sellers** conforme contrato já existente. |

**Nota:** Os detalhes de **corpo**, **códigos HTTP** de erro e **formato** de resposta de **register**, **login**, **profile** e **sellers** permanecem os já definidos pelo users-service e pelo gateway; esta spec exige apenas que o **caminho através do gateway** funcione de **ponta a ponta**.

---

## 4. Critérios de aceite (E2E testáveis)

Os critérios abaixo devem ser **executáveis** com **curl**, **Postman** ou ferramenta equivalente, **sempre** usando a **base URL do gateway** (porta **3005**), salvo onde se indica verificação direta ao users-service apenas para health.

1. Com **users-service** e **api-gateway** em execução e **`USERS_SERVICE_URL`** apontando para o users-service, **`GET {gateway}/health`** (ou o endpoint de health global do gateway definido no projeto) reflete **saúde** conforme a implementação existente; e o health do users-service é **atingível** de forma consistente com o uso de **`GET /health`** no users-service (conforme secção 1.2), quando o gateway o consultar.
2. **`GET http://localhost:3000/health`** (users-service) retorna **`status`** **`"ok"`** e **`service`** **`"users-service"`** **sem** cabeçalho de autorização.
3. **`POST /auth/register`** via gateway cria utilizador com sucesso (código e corpo conforme contrato existente).
4. **`POST /auth/login`** via gateway devolve token JWT utilizável no cabeçalho **`Authorization: Bearer <token>`**.
5. **`GET /users/profile`** via gateway **com** token válido retorna o perfil do utilizador autenticado (**200** conforme serviço).
6. **`GET /users/profile`** via gateway **sem** token ou com token inválido **não** devolve o perfil com sucesso (**401** ou comportamento de negação já definido no gateway).
7. **`GET /users/sellers`** via gateway **com** token válido retorna a lista esperada (**200**).
8. **`GET /auth/validate-token`** no users-service **com** o mesmo token usado no gateway retorna **200** com **`userId`**, **`email`** e **`role`**; **sem** token ou com token inválido retorna **401** (ou equivalente de não autorizado do serviço).
9. A documentação Swagger do users-service está disponível em **`/api`** com título **"Users Service"**, versão **1.0**, e **Bearer Auth** configurado para testes.

---

## 5. Dependências e alinhamento

- **Autenticação JWT**, guards e **`@Public()`** no users-service: specs anteriores do repositório (**03**, **05**).
- **Endpoints de utilizadores**: spec **06-endpoints-consulta-usuarios**.
- **Gateway**: comportamento de proxy e JWT **já implementados**; esta spec **não** os redesenha.

---

## 6. Entregáveis resumidos

| Área | Entregável |
|------|------------|
| users-service | **`GET /auth/validate-token`** (protegido); **`GET /health`** (público); Swagger em **`/api`** com metadados e Bearer. |
| api-gateway | **`.env`** com **`USERS_SERVICE_URL=http://localhost:3000`**; evidência de verificação de proxy **`/auth/*`**, **`/users/*`** e reencaminhamento de **`Authorization`**. |
| Integração | Fluxo E2E **register → login → profile → sellers** via gateway; critérios da secção 4 cumpridos. |
