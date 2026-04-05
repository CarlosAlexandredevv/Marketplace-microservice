# Spec: login com JWT (`POST /auth/login`)

## Contexto

O **users-service** já possui scaffold NestJS, PostgreSQL, TypeORM, entidade **`User`** e **`POST /auth/register`** funcionando (`AuthModule` com controller e service). Esta especificação cobre **apenas** o fluxo de **login** que valida e-mail e senha e devolve um **token JWT** de acesso, junto com a representação pública do usuário.

Stack de referência: **NestJS**, **@nestjs/jwt**, **@nestjs/passport**, **passport**, **passport-jwt**, **bcryptjs** (para comparação da senha com o hash persistido). A assinatura e emissão do JWT no login utilizam **@nestjs/jwt**; **passport** e **passport-jwt** entram no ecossistema do serviço para alinhamento com padrões Nest, **sem** uso nesta spec para proteção de rotas (isso será especificado depois).

**Fora de escopo desta spec:** proteção de rotas (guards), validação de JWT em requisições subsequentes, sessões, refresh tokens, recuperação de senha, rate limiting, integração com api-gateway além do que já existir, e qualquer mecanismo além do **JWT de acesso com expiração fixa de 24 horas**.

---

## 1. Requisitos funcionais

1. **Endpoint de login**  
   Expor **`POST /auth/login`** que aceita o corpo descrito na seção 2 (DTO de login).

2. **Identificação do usuário**  
   Buscar no banco o usuário cujo **`email`** corresponde ao informado na requisição, de forma **consistente** com a política já adotada no serviço para unicidade de e-mail no registro (por exemplo, comparação case-insensitive se esse for o comportamento acordado).

3. **Verificação de senha**  
   Se existir usuário com aquele e-mail, comparar a senha enviada no corpo com o **hash** armazenado usando **bcrypt** (bcryptjs, conforme stack). A senha em texto plano **não** deve ser logada nem retornada.

4. **Conta ativa**  
   Após confirmar que o e-mail existe e a senha confere, o sistema deve verificar se **`status`** do usuário é exatamente **`active`**. Se o usuário existir e a senha estiver correta, mas **`status` ≠ `active`**, a operação **não** emite token e a API responde conforme a seção 4 (401 com mensagem específica).

5. **Emissão do JWT**  
   Quando e-mail existe, senha confere e **`status === active`**, gerar um **JWT de acesso** assinado com **secret** obtido da variável de ambiente **`JWT_SECRET`**. O token deve expirar **24 horas** após a emissão (tempo de vida fixo nesta spec).

6. **Payload do token**  
   O conteúdo assinado do JWT (claims/payload) deve seguir a seção 3.

7. **Resposta de sucesso**  
   Em caso de login válido, retornar um objeto JSON contendo:
   - **`user`**: representação do usuário **sem** o campo **`password`** (nem hash), incluindo os mesmos campos públicos que a API já expõe para o usuário em outros fluxos (por exemplo `id`, `email`, `firstName`, `lastName`, `role`, `status`, `createdAt`, `updatedAt`, conforme modelo atual).
   - **`token`**: string do JWT emitido.

8. **Mensagens de erro — credenciais**  
   Para **e-mail inexistente** ou **senha incorreta** (incluindo quando o e-mail existe mas a senha não confere), utilizar **a mesma** mensagem genérica **`Credenciais inválidas`** no corpo da resposta, **sem** indicar se o problema foi o e-mail ou a senha (mitigação de enumeração de contas).

9. **Mensagem de erro — conta inativa**  
   Quando o e-mail existe, a senha está correta, mas **`status` ≠ `active`**, retornar mensagem específica **`Conta inativa`** (ainda como 401, conforme seção 4).

10. **Configuração**  
    O segredo usado para assinar o JWT deve vir **exclusivamente** da variável de ambiente **`JWT_SECRET`**. A ausência ou valor inválido do segredo em ambiente de execução deve ser tratada de acordo com a política global do serviço (falha na subida ou erro claro em runtime), sem hardcode de segredo em código de produção.

11. **Validação de entrada**  
    Os campos do DTO da seção 2 devem ser validados antes da lógica de autenticação. Falhas de validação seguem o padrão global da aplicação (tipicamente **400 Bad Request** com erros por campo), distinto do **401** por falha de autenticação ou conta inativa.

---

## 2. Estrutura de dados — DTO de login

Corpo esperado em **`POST /auth/login`**:

| Campo       | Obrigatório | Regras |
|------------|-------------|--------|
| `email`    | Sim         | Formato de e-mail válido. |
| `password` | Sim         | Mínimo **6** caracteres. |

**Não** faz parte do contrato de resposta de sucesso: `password` em qualquer forma.

---

## 3. Estrutura do payload JWT

Claims presentes no payload assinado do token (além de campos padrão do JWT como `iat`/`exp`, se a biblioteca os incluir):

| Claim  | Significado |
|--------|-------------|
| `sub`  | Identificador do usuário (**UUID** de `User.id`). |
| `email`| E-mail do usuário autenticado. |
| `role` | Papel do usuário: **`seller`** ou **`buyer`**, alinhado ao valor persistido na entidade. |

O payload **não** deve incluir senha, hash ou dados desnecessários além do necessário para identidade e autorização futura.

---

## 4. Respostas HTTP esperadas

### 200 OK

- Login bem-sucedido (e-mail encontrado, senha válida, **`status === active`**).
- Corpo: **`{ "user": { ... }, "token": "<jwt-string>" }`**, onde `user` não contém `password`.

### 400 Bad Request

- Corpo da requisição inválido segundo a seção 2 (validação de DTO).
- Comportamento e formato de erro alinhados ao **`ValidationPipe`** global e aos demais endpoints do serviço (lista estruturada de erros por campo quando aplicável).

### 401 Unauthorized

- **Credenciais inválidas:** e-mail não encontrado **ou** senha não confere com o hash. Corpo: mensagem genérica **`Credenciais inválidas`** (mesmo texto nos dois casos).
- **Conta inativa:** e-mail e senha corretos, mas **`status` ≠ `active`**. Corpo: mensagem **`Conta inativa`**.
- Em ambos os subcasos, **não** retornar token e **não** incluir `password` no corpo.

**Códigos não listados acima** (por exemplo 500) seguem a política global de erros do serviço.

---

## 5. Critérios de aceite (testáveis)

1. **`POST /auth/login`** com `email` e `password` válidos, usuário existente, senha correta e **`status === active`**, retorna **200** com `user` sem `password` e `token` como string não vazia.

2. O JWT retornado no critério 1 pode ser decodificado (para teste) de forma a evidenciar **`sub`** igual ao UUID do usuário, **`email`** e **`role`** coerentes com o registro, e **`exp`** correspondente a **24 horas** após a emissão (tolerância de segundos aceitável ao relógio do ambiente de teste).

3. **`POST /auth/login`** com e-mail **inexistente** retorna **401** com corpo contendo a mensagem **`Credenciais inválidas`** (e sem revelar que o e-mail não existe).

4. **`POST /auth/login`** com e-mail existente e senha **incorreta** retorna **401** com a **mesma** mensagem **`Credenciais inválidas`** que no critério 3.

5. **`POST /auth/login`** com usuário existente, senha correta e **`status` diferente de `active`** retorna **401** com mensagem **`Conta inativa`** e **sem** campo `token`.

6. Payload sem `email` ou com e-mail mal formado retorna **400** com erro de validação adequado.

7. Payload com `password` com **menos de 6** caracteres retorna **400** com erro de validação adequado.

8. Em nenhuma resposta documentada o campo `password` (ou hash) aparece no objeto `user` ou em outro lugar do JSON.

9. A emissão do JWT depende da variável **`JWT_SECRET`** configurada no ambiente de execução dos testes (ou documentação de teste equivalente), sem uso de segredo fixo em código para produção.

10. O fluxo de login é exposto pelo **`AuthModule`** existente (controller/service de autenticação), compondo com a camada de persistência de usuários já utilizada no registro.

---

## 6. Dependências e ordem sugerida (sem implementação)

- Depende da spec **02-auth-register** (entidade `User`, hash de senha, `POST /auth/register`) e **01-scaffold** (TypeORM, pipe global).
- Reutilizar consulta por e-mail e modelo `User` já alinhados ao registro.
- Registrar/configurar o módulo JWT do Nest com expiração de 24 horas e secret a partir de **`JWT_SECRET`**.
- Testes: pelo menos fluxos e2e ou integração cobrindo **200**, **401** (credenciais inválidas — dois cenários indistinguíveis pela mensagem), **401** (conta inativa), e **400** (validação).

---

## 7. Rastreabilidade

- Depende de: **01-scaffold**, **02-auth-register**.
- Complementada por: spec futura de **proteção de rotas / guards** e validação de JWT com **passport-jwt** (fora do escopo deste documento).
