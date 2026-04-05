# Spec: validação JWT e proteção global de rotas (products-service)

## Contexto

O **products-service** (porta **3001**) já possui scaffold **NestJS**, **Docker Compose** com **PostgreSQL** (porta **5434**), **TypeORM** configurado e entidade **Product**. Não possui fluxo de login ou registro.

O **users-service** (porta **3000**) emite tokens **JWT** com payload contendo **`sub`** (UUID do usuário), **`email`** e **`role`** com valores **`seller`** ou **`buyer`**. A variável de ambiente **`JWT_SECRET`** é **compartilhada** entre os serviços (mesmo valor), de modo que o products-service possa **validar** tokens emitidos pelo users-service **sem** reimplementar emissão ou endpoints de autenticação.

Esta especificação cobre **somente** a **validação de JWT** em requisições ao products-service e a **proteção padrão das rotas**, com exceções explícitas via decorator de rota pública. A stack acordada é **NestJS** com **`@nestjs/jwt`**, **`@nestjs/passport`**, **`passport`** e **`passport-jwt`**.

**Fora de escopo:** endpoints **`POST /auth/register`**, **`POST /auth/login`** ou qualquer outro endpoint de credenciais no products-service; **RoleGuard** ou guard genérico por papel (a checagem de **`role`** fica nos controllers/services conforme necessidade de negócio); refresh tokens; revogação de token; alteração do contrato de emissão de JWT no users-service.

**Não** inclui código neste documento — apenas **o quê** deve ser entregue, não **como** implementar.

---

## 1. Requisitos funcionais

### 1.1 Alinhamento com o users-service

1. A solução deve **replicar o mesmo padrão arquitetural** já adotado no **users-service** para JWT com Passport: organização em **AuthModule**, **JwtStrategy**, **JwtAuthGuard**, constante de metadata para rotas públicas, decorator **`@Public()`**, registro do **Passport** com estratégia JWT nomeada de forma consistente com o projeto de referência, e uso de **`ConfigService`** para obter **`JWT_SECRET`** com a mesma regra de validade (secret obrigatório e não vazio). O **JwtModule** deve ser configurado de forma **análoga** à do users-service no que couber à **validação** e ao **segredo** compartilhado (o products-service **não** precisa expor endpoints de auth; o módulo concentra apenas o necessário para validação e guard).

2. **Não** criar no products-service **controllers**, **services** ou rotas de **login**/**registro**. Toda emissão de token permanece no **users-service**.

### 1.2 Estratégia JWT (Passport)

3. Deve existir uma **JwtStrategy** que:

   - Extraia o token do cabeçalho **`Authorization`** no formato **`Bearer <token>`** (token após o prefixo e um espaço).
   - Valide **automaticamente** a **assinatura** do token e a **expiração**, usando o mesmo **`JWT_SECRET`** que o users-service utiliza na emissão, com política de expiração **coerente** com o token emitido (não ignorar expiração na validação).
   - Após validação bem-sucedida, disponibilize para o ecossistema Passport/Nest um objeto de usuário autenticado acessível como **`req.user`** em rotas protegidas, contendo pelo menos:
     - **`id`**: identificador do usuário, **coerente** com o UUID representado por **`sub`** no payload.
     - **`email`**: valor do claim **`email`**.
     - **`role`**: valor do claim **`role`** (**`seller`** ou **`buyer`**, conforme emitido).

### 1.3 Guard de autenticação JWT

4. Deve existir um **JwtAuthGuard** que:

   - Herde do **`AuthGuard`** do Passport associado à estratégia JWT do projeto (mesmo padrão do users-service).
   - Antes de exigir autenticação, verifique se o manipulador ou a classe do controller possui o **metadata** acordado para rota **pública** (mesma abordagem de chave/reflexão do users-service).
   - Se a rota for **pública**, permita o acesso **sem** exigir token válido; **`req.user`** não é obrigatório nesse caso (comportamento alinhado ao padrão quando a autenticação é ignorada).
   - Se a rota **não** for pública, aplique a validação JWT completa; em sucesso, **`req.user`** deve refletir o objeto descrito em **1.2**.

5. O **JwtAuthGuard** deve ser registrado como **guard global** da aplicação (**`APP_GUARD`**), de forma que **todas** as rotas fiquem protegidas **por padrão**, exceto as explicitamente marcadas como públicas.

### 1.4 Decorator de rota pública

6. Deve existir um decorator **`@Public()`** que marque manipulador ou classe como **não exigindo** JWT, utilizando o **mesmo mecanismo de metadata** que o **JwtAuthGuard** do users-service utiliza para leitura via **Reflector**, garantindo consistência entre microserviços.

### 1.5 Rotas públicas no products-service

7. Rotas que devam permanecer acessíveis **sem** token (por exemplo **health check**, raiz **`GET /`**, ou documentação futura) devem ser explicitamente decoradas com **`@Public()`**. A lista exata por endpoint deve ser fechada no **plano de implementação**; o critério é que **nenhuma** rota operacional desejada sem autenticação fique sem o decorator após a ativação do guard global.

8. Qualquer rota de **negócio** de produtos (presentes ou futuras) que deva exigir usuário autenticado **não** deve usar **`@Public()`**, salvo decisão documentada de exceção.

---

## 2. Validação do token e contrato do cabeçalho

1. O token é enviado em **`Authorization: Bearer <token>`**; formatos incompatíveis tratam-se como falha de autenticação nas rotas protegidas (comportamento **401**, conforme seção 4).

2. **Assinatura** e **expiração** são validadas pela stack Passport JWT (**passport-jwt**), sem desativar verificação de expiração.

3. O payload esperado é o **mesmo** emitido pelo login do users-service: **`sub`**, **`email`**, **`role`**. O objeto em **`req.user`** expõe **`id`** alinhado a **`sub`**, mais **`email`** e **`role`**, como no users-service.

---

## 3. Fluxo esperado de uma requisição

1. A requisição HTTP chega ao products-service.
2. O **JwtAuthGuard** global intercepta a requisição.
3. O guard verifica se o destino é rota **`@Public()`** (handler ou classe).
4. **Se for pública:** o fluxo segue sem exigência de JWT.
5. **Se não for pública:** extração do token **`Bearer`**, validação de assinatura e expiração.
6. Se válido, **`req.user`** contém **`id`**, **`email`** e **`role`**; a cadeia de controllers/services prossegue.
7. Se inválido, ausente (quando obrigatório) ou expirado, a resposta segue a seção 4.

---

## 4. Respostas esperadas para rotas protegidas

| Situação | Comportamento esperado |
|----------|-------------------------|
| Token **ausente** em rota **não** pública | Resposta **401 Unauthorized**. |
| Token **expirado** | Resposta **401 Unauthorized**. |
| Token com **assinatura inválida** ou incompatível com o secret compartilhado | Resposta **401 Unauthorized**. |
| Token **válido** (emitido pelo users-service, mesmo secret, não expirado, payload alinhado) | Processamento normal da rota; **não** retornar **401** por falha de autenticação. |

Rotas **`@Public()`** **não** devem retornar **401** apenas pela **ausência** de **`Authorization`**. O corpo e o formato exatos da mensagem de **401** podem seguir o padrão já usado no serviço (filtros de exceção, mensagens genéricas), desde que o **código HTTP** seja **401** nos casos de falha de autenticação acima.

---

## 5. Critérios de aceite (claros e testáveis)

1. **Guard global:** o **JwtAuthGuard** está registrado como **`APP_GUARD`**; não é necessário repetir o guard em cada rota para que a proteção padrão valha em toda a aplicação.

2. **Rotas públicas:** todo endpoint listado no plano como público (por exemplo **`GET /health`** e **`GET /`**, se assim definido) responde com sucesso **sem** cabeçalho **`Authorization`**.

3. **Rota protegida sem token:** ao menos uma rota **não** decorada com **`@Public()`** (endpoint de produtos existente ou fixture mínima criada para teste, conforme plano) retorna **401** quando chamada **sem** **`Authorization`**.

4. **Token inválido ou expirado:** a mesma rota protegida retorna **401** com token **malformado**, **assinatura inválida** ou **expirado** (reproduzível em teste automatizado).

5. **Token válido:** uma requisição com **`Authorization: Bearer <token>`**, onde **`<token>`** é um JWT **válido** obtido do **users-service** (mesmo **`JWT_SECRET`**, dentro da validade, payload com **`sub`**, **`email`**, **`role`**) à rota protegida **não** recebe **401** por autenticação; o manipulador (ou teste e2e/integração) consegue observar em **`req.user`** os campos **`id`**, **`email`** e **`role`** coerentes com o token e o usuário.

6. **Sem endpoints de auth no products-service:** não existem rotas de **login** ou **registro** no products-service após a entrega.

7. **Sem RoleGuard:** não há guard dedicado exclusivamente à verificação de papel; a validação de **`role`** para regras de negócio permanece responsabilidade dos controllers/services quando aplicável.

8. **Dependências:** o **`package.json`** do products-service inclui **`@nestjs/jwt`**, **`@nestjs/passport`**, **`passport`**, **`passport-jwt`** e tipos necessários para **`passport-jwt`**, de acordo com a stack acordada.

---

## 6. Dependências e rastreabilidade

- **Depende de:** users-service emitindo JWT com o payload acordado; **`JWT_SECRET`** idêntico configurado em ambos os serviços; variáveis de ambiente carregadas no bootstrap do Nest (por exemplo **`ConfigModule`** global, alinhado ao projeto).
- **Complementada por:** specs ou tarefas futuras para CRUD de produtos protegido, regras por **`role`** nos serviços, integração com API Gateway, etc.

---

## 7. Ordem sugerida para o plano de implementação (referência, sem código)

1. Adicionar dependências **`@nestjs/jwt`**, **`@nestjs/passport`**, **`passport`**, **`passport-jwt`** (e tipos).
2. Criar **AuthModule** espelhando a estrutura do users-service **apenas** para validação (estratégia, guard, módulos Passport/JWT, exportações necessárias), **sem** endpoints de auth.
3. Implementar **JwtStrategy**, **JwtAuthGuard**, constante de metadata e **`@Public()`** no mesmo padrão do users-service.
4. Registrar **`APP_GUARD`** com **JwtAuthGuard** no módulo raiz da aplicação.
5. Aplicar **`@Public()`** nas rotas operacionais acordadas (health, raiz, etc.).
6. Cobrir os critérios da seção **5** com testes (e2e ou integração), incluindo obtenção de token válido via users-service ou geração controlada equivalente ao mesmo secret e payload.
