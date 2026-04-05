# Spec: guards JWT e proteção global de rotas (users-service)

## Contexto

O **users-service** já possui **NestJS**, **PostgreSQL**, entidade **`User`**, **`POST /auth/register`** e **`POST /auth/login`** com emissão de **JWT** funcionando. O **`JwtModule`** está configurado no **`AuthModule`**, com **secret** obtido via variável de ambiente e **expiração de 24 horas**. As dependências **`@nestjs/passport`**, **`passport`** e **`passport-jwt`** já estão instaladas.

O payload do token emitido no login segue a spec **03-auth-login-jwt** (claims **`sub`** como UUID do usuário, **`email`**, **`role`**). Esta especificação cobre **apenas** a **validação do JWT em requisições subsequentes** e a **proteção automática das rotas** da aplicação, com exceções explícitas para rotas públicas.

**Fora de escopo desta spec:** implementação de **RoleGuard**, **SessionGuard** ou qualquer guard baseado em papéis ou sessão; criação de **novos endpoints** ou rotas de negócio além de marcar como públicas as já existentes citadas abaixo; refresh tokens; revogação de token; integração com API Gateway além do contrato HTTP atual do serviço.

**Não** inclui código neste documento — apenas **o quê** deve ser entregue, não **como** implementar.

---

## 1. Requisitos funcionais

### 1.1 Estratégia JWT (Passport)

1. Deve existir uma **JwtStrategy** (integração **Passport** + **passport-jwt**) que:
   - **Extraia** o token JWT do cabeçal **`Authorization`**, no formato **`Bearer <token>`** (token após o prefixo e um espaço).
   - **Valide** automaticamente a **assinatura** do token e a **expiração**, utilizando o mesmo **secret** e política de tempo de vida já adotados na emissão do JWT (alinhados ao **`JwtModule`** / **`JWT_SECRET`** e expiração de **24h**).
   - Após validação bem-sucedida, **disponibilize** para o Nest um objeto de usuário autenticado contendo pelo menos:
     - **`id`**: identificador do usuário, **coerente** com o UUID representado por **`sub`** no payload do token.
     - **`email`**: valor do claim **`email`** do payload.
     - **`role`**: valor do claim **`role`** do payload.
   - Esse objeto deve ser o que o ecossistema Passport/Nest associa à requisição de forma que fique acessível como **`req.user`** em rotas protegidas (sem exigir nesta spec tipagem explícita de `Request` em documentação de código).

### 1.2 Guard de autenticação JWT

2. Deve existir um **JwtAuthGuard** que:
   - **Herde** do **`AuthGuard`** do Passport com a estratégia JWT configurada.
   - **Antes** de exigir autenticação, verifique se o manipulador da rota (ou a rota) possui o **metadata** acordado para indicar rota **pública** (ver seção 1.3).
   - Se a rota for **pública**, **permita** o acesso **sem** exigir token válido e **sem** preencher **`req.user`** por obrigação desta spec (comportamento pode seguir o padrão do Passport quando a autenticação é ignorada).
   - Se a rota **não** for pública, aplique a validação JWT **normalmente** (extração, assinatura, expiração); em sucesso, **`req.user`** deve refletir o objeto descrito em 1.1.
   - O guard deve ser registrado como **guard global** da aplicação (**`APP_GUARD`**), de forma que **todas** as rotas do serviço fiquem protegidas **por padrão**, exceto as explicitamente marcadas como públicas.

### 1.3 Decorator de rota pública

3. Deve existir um decorator **`@Public()`** que:
   - Marque o manipulador (ou classe, conforme convenção do projeto) como **não exigindo** autenticação JWT.
   - Utilize o mecanismo de **metadata** do NestJS para comunicar essa informação ao **JwtAuthGuard**, de modo que o guard consiga distinguir rotas públicas das demais de forma **declarativa** e **consistente**.

### 1.4 Rotas existentes a marcar como públicas

4. As rotas já existentes abaixo devem ser marcadas com **`@Public()`**:
   - **`POST /auth/register`**
   - **`POST /auth/login`**

5. Todas as rotas **sem** **`@Public()`** passam a exigir JWT válido. **Nesta spec**, a obrigatoriedade explícita de marcar como públicas aplica-se apenas a **`POST /auth/register`** e **`POST /auth/login`**; outras rotas já existentes (por exemplo health ou documentação, se houver) devem ser tratadas no **plano de implementação** (decorar como públicas ou manter protegidas), sem alterar o escopo funcional deste documento além do guard global e das duas rotas citadas.

---

## 2. Fluxo esperado de uma requisição

1. A requisição HTTP chega à aplicação.
2. O **JwtAuthGuard** global intercepta a requisição.
3. O guard verifica se o destino é uma rota marcada com **`@Public()`**.
4. **Se for pública:** o fluxo segue sem exigência de JWT (conforme 1.2).
5. **Se não for pública:** o guard aciona a estratégia JWT — extração do token no header **`Authorization: Bearer <token>`**, validação de assinatura e expiração.
6. Se o token for válido, os dados do usuário (**`id`**, **`email`**, **`role`**) ficam disponíveis em **`req.user`** e o **controller** (e demais camadas) processam a requisição normalmente.
7. Se o token for inválido, ausente (quando obrigatório) ou expirado, a resposta segue a seção 3.

---

## 3. Respostas esperadas para rotas protegidas

| Situação | Comportamento esperado |
|----------|-------------------------|
| Token **ausente** em rota **não** pública | Resposta **401 Unauthorized**. |
| Token **expirado** | Resposta **401 Unauthorized**. |
| Token com **assinatura inválida** ou payload incompatível com o esperado pela estratégia | Resposta **401 Unauthorized**. |
| Token **válido** em rota **não** pública | Processamento normal da rota (**2xx** ou outros códigos conforme regra de negócio da rota). |

**Observações:**

- O **corpo** e o **formato** exatos da mensagem de **401** podem seguir o padrão já utilizado no serviço para erros HTTP (por exemplo, mensagem genérica ou estrutura do filtro de exceções global), desde que o **código HTTP** seja **401** nos casos acima.
- Rotas **`@Public()`** **não** devem retornar **401** por **ausência de token** apenas por essa ausência.

---

## 4. Critérios de aceite (claros e testáveis)

1. **`POST /auth/register`** e **`POST /auth/login`** respondem com **sucesso** (códigos já definidos por suas specs) **sem** enviar cabeçalho **`Authorization`**, desde que o corpo e demais requisitos desses endpoints sejam atendidos.

2. Uma rota **protegida** de teste (por exemplo, um endpoint mínimo existente apenas em ambiente de teste ou uma rota real futura coberta por teste) — **ou**, na ausência de rota de negócio nova nesta spec, **qualquer rota não pública** já existente no serviço — retorna **401** quando chamada **sem** o cabeçalho **`Authorization`**.

3. A mesma rota protegida do critério 2 retorna **401** quando o cabeçalho **`Authorization`** está presente mas o token está **malformado**, com **assinatura inválida** ou **expirado** (cenários reproduzíveis em teste automatizado).

4. Para uma requisição a rota protegida com **`Authorization: Bearer <token>`** onde `<token>` é um JWT **válido** emitido pelo login (mesmo secret, não expirado, payload alinhado à spec 03), a resposta **não** é **401** por falha de autenticação; e o manipulador consegue **observar** em **`req.user`** os campos **`id`**, **`email`** e **`role`** coerentes com o usuário e o token (por teste e2e ou integração que inspecione o contexto da requisição).

5. O **JwtAuthGuard** está aplicado de forma **global** (`APP_GUARD`): não é necessário repetir o guard em cada controller para que a proteção padrão valha em toda a aplicação.

6. Não há nesta entrega **RoleGuard**, **SessionGuard** nem novos endpoints de produto além do necessário para testes internos, se o projeto assim precisar (preferência: validar com rota existente não pública ou fixture de teste documentada no plano de implementação).

---

## 5. Dependências e rastreabilidade

- Depende de: **01-scaffold**, **02-auth-register**, **03-auth-login-jwt** (payload JWT e **`JWT_SECRET`**).
- Complementada por: specs futuras de novos endpoints protegidos, guards por papel (se desejado), refresh/revogação, etc.

---

## 6. Ordem sugerida para o plano de implementação (referência, sem código)

1. Registrar estratégia JWT e validação alinhada ao token já emitido.
2. Implementar metadata + **`@Public()`** e **JwtAuthGuard** com lógica de bypass para públicas.
3. Registrar guard como **`APP_GUARD`**.
4. Aplicar **`@Public()`** em **`POST /auth/register`** e **`POST /auth/login`**.
5. Ajustar ou adicionar testes (e2e/integração) cobrindo critérios da seção 4.

## 7 Commits 

Faça commits a cada implementação
