# Spec: registro de usuário (`POST /auth/register`)

## Contexto

O **users-service** já possui scaffold NestJS, PostgreSQL via Docker Compose, TypeORM e a entidade **`User`** (`id`, `email`, `password`, `firstName`, `lastName`, `role`, `status`, `createdAt`, `updatedAt`). Esta especificação cobre **apenas** o fluxo de **cadastro de novo usuário** via HTTP.

Stack de referência: **NestJS**, **TypeORM**, **bcryptjs** para hash de senha (10 salt rounds). Validação de entrada deve produzir mensagens **claras** para o cliente (campos e motivos compreensíveis).

**Fora de escopo desta spec:** login, JWT, refresh tokens, recuperação de senha, verificação de e-mail, rate limiting, integração com api-gateway, e quaisquer outros endpoints de autenticação — serão tratados em especificações futuras.

---

## 1. Requisitos funcionais

1. **Módulo de autenticação**  
   Deve existir um **`AuthModule`** registrado na aplicação, contendo **controller** e **service** dedicados ao fluxo de autenticação/cadastro coberto aqui (nesta spec, somente registro). O módulo deve compor com o módulo de usuários de forma que a persistência e as regras de unicidade de e-mail sejam respeitadas.

2. **Endpoint de registro**  
   Expor **`POST /auth/register`** que aceita o corpo descrito na seção 2 (DTO de criação), persiste um novo registro na tabela de usuários e retorna a representação pública do usuário criado.

3. **Senha**  
   A senha recebida no corpo da requisição **nunca** deve ser armazenada em texto plano. Deve ser persistido apenas o **hash** gerado com **bcrypt** (ou bcryptjs, conforme stack), com **10 salt rounds**.

4. **Unicidade de e-mail**  
   Antes de inserir, o sistema deve verificar se já existe usuário com o mesmo **`email`** (comparação coerente com o modelo: normalmente case-insensitive no domínio de e-mail, conforme política do produto — a implementação deve ser explícita e consistente). Se já existir, a operação **não** cria registro e a API responde com **409 Conflict**, com mensagem clara de que o e-mail já está em uso (sem expor dados sensíveis de contas existentes).

5. **Resposta sem senha**  
   Qualquer resposta de sucesso ou de erro que serializa dados do usuário **não** pode incluir o campo **`password`** nem o hash (nem equivalente).

6. **Status do usuário**  
   Usuários criados por este fluxo devem ter **`status`** definido automaticamente como **`active`**, independentemente de valores eventualmente enviados no corpo (o DTO de registro **não** deve permitir ao cliente escolher `status`).

7. **Validação de entrada**  
   Todos os campos obrigatórios e regras da seção 2 devem ser validados. Em caso de falha, a API responde com **400 Bad Request** e uma **lista estruturada de erros de validação** (por campo ou regra), com mensagens compreensíveis para correção pelo cliente.

8. **Papel (`role`)**  
   O cliente informa **`role`** conforme seção 2; valores fora do conjunto permitido devem falhar na validação (400), não na persistência com valor inválido.

---

## 2. Estrutura de dados — DTO de criação (registro)

Corpo esperado em **`POST /auth/register`** (conceitual; nomes de propriedades alinhados à convenção do projeto):

| Campo        | Obrigatório | Regras |
|-------------|-------------|--------|
| `email`     | Sim         | Formato de e-mail válido. |
| `password`  | Sim         | Mínimo **6** caracteres. |
| `firstName` | Sim         | Máximo **100** caracteres. |
| `lastName`  | Sim         | Máximo **100** caracteres. |
| `role`      | Sim         | Exatamente **`seller`** ou **`buyer`** (alinhado aos valores da entidade `User`). |

**Não** faz parte do DTO: `id`, `password` na resposta, `status` (definido pelo sistema), `createdAt`, `updatedAt` (geridos pelo banco/aplicação).

**Nota de alinhamento com persistência:** a entidade atual pode declarar colunas com limite maior que 100 para nomes; a regra de **negócio** para registro é o teto de **100** caracteres em `firstName` e `lastName` conforme esta spec.

---

## 3. Respostas HTTP esperadas

### 201 Created

- Usuário criado com sucesso.
- Corpo: objeto do usuário **sem** `password`, contendo pelo menos: `id`, `email`, `firstName`, `lastName`, `role`, `status`, `createdAt`, `updatedAt` (formato de datas acordado com o restante da API, por exemplo ISO 8601 em JSON).
- Cabeçalho **`Location`** é desejável apontando para o recurso do usuário **se** e quando existir rota GET de usuário na API; caso ainda não exista, pode ser omitido ou definido em spec de usuários — não é bloqueante para esta spec.

### 400 Bad Request

- Dados inválidos (validação falhou).
- Corpo: estrutura que permita ao cliente identificar **cada** erro (campo + mensagem ou código de erro de validação), sem vazar informação interna de implementação.
- Exemplos de situações: e-mail mal formado, senha curta, nomes acima do máximo, `role` inválido, corpo ausente ou JSON inválido (comportamento alinhado ao padrão global da aplicação).

### 409 Conflict

- Tentativa de cadastro com **`email`** já existente no banco.
- Corpo: mensagem clara indicando conflito de e-mail, **sem** incluir `password` nem dados de outras contas.

### 401 Unauthorized

- Quando a política de acesso ao serviço exigir **credenciais válidas** (por exemplo, em cenários futuros de API key, cliente autenticado no gateway, ou outro mecanismo definido em specs de segurança) e a requisição estiver **sem** credenciais ou com credenciais **inválidas**.
- Corpo e cabeçalhos: **mínimos** — mensagem genérica do tipo “credenciais inválidas” ou equivalente, **sem** detalhar se o usuário existe, se a chave expirou, ou qual campo falhou, para reduzir superfície de enumeração para atacantes.
- **Nota:** se o registro for **público** na implantação atual, este código pode não ser acionado por este endpoint até existir camada de credenciais; a spec define o contrato para quando for aplicável.

**Códigos não listados acima** (por exemplo 500) seguem política global de erros do serviço e não precisam ser detalhados aqui, exceto que respostas de erro também **não** devem incluir `password`.

---

## 4. Critérios de aceite (testáveis)

1. **`POST /auth/register`** com payload válido e e-mail inédito resulta em **201**, persistência de um usuário com `status === active`, senha armazenada **apenas** como hash compatível com bcrypt (10 rounds), e corpo de resposta **sem** campo `password`.

2. Dois cadastros com o **mesmo** `email` (segundo após o primeiro): o segundo retorna **409** e **não** cria novo registro.

3. Payload com `password` com **menos de 6** caracteres retorna **400** com indicação explícita da regra violada (lista de erros de validação).

4. Payload com `email` inválido (formato) retorna **400** com mensagem clara.

5. Payload com `firstName` ou `lastName` com **mais de 100** caracteres retorna **400**.

6. Payload com `role` diferente de `seller` e `buyer` retorna **400**.

7. Payload omitindo qualquer campo obrigatório retorna **400** cobrindo o campo ausente.

8. Resposta **201** inclui `role` e `status` coerentes com o que foi solicitado e com a regra automática de `status` (`active`).

9. Em qualquer resposta de sucesso ou erro documentada que retorne dados de usuário, **não** aparece `password` nem representação do segredo.

10. Quando o cenário de **401** for exercitável (credenciais exigidas e inválidas/ausentes), a resposta **não** revela detalhes específicos além do necessário (mensagem genérica).

11. O **`AuthModule`** está registrado na aplicação e o registro é realizado através do fluxo exposto pelo controller/service de autenticação (teste de integração ou e2e pode validar rota e módulo carregado).

---

## 5. Dependências e ordem sugerida (sem implementação)

- Reutilizar entidade **`User`**, repositório ou serviço de usuários existente para consulta por e-mail e criação.
- Garantir que **`ValidationPipe`** global (já previsto no scaffold) atue sobre o DTO de registro.
- Testes: pelo menos um fluxo e2e ou integração cobrindo **201**, **409** e um caso de **400** representativo.

---

## 6. Rastreabilidade

- Depende de: spec **01-scaffold** (entidade User, TypeORM, Compose, pipe global).
- Substituída ou estendida por: specs futuras de login/JWT, perfil de usuário, e política de segurança no gateway.
