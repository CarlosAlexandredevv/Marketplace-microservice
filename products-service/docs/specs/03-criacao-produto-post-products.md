# Spec: criação de produto — `POST /products` (products-service)

## Contexto

O **products-service** (porta **3001**) já possui scaffold **NestJS**, **PostgreSQL** (porta **5434**), **TypeORM** com entidade **Product** (campos: **id**, **name**, **description**, **price**, **stock**, **sellerId**, **isActive**, **createdAt**, **updatedAt**) e **autenticação JWT** operacional: **guard global**, decorator **`@Public()`** para exceções, e **`req.user`** com **id**, **email** e **role** após autenticação bem-sucedida.

O **sellerId** do produto no banco representa o **identificador do vendedor** e **deve** ser obtido exclusivamente do usuário autenticado (**`req.user.id`**, alinhado ao **`sub`** do JWT). **Não** é aceitável aceitar **`sellerId`** no corpo da requisição de criação.

Apenas usuários com **`role`** igual a **`seller`** podem criar produtos; usuários **`buyer`** devem receber recusa explícita com código HTTP **403 Forbidden**.

**Não** inclui código neste documento — apenas **o quê** deve ser entregue, não **como** implementar.

**Fora de escopo:** endpoints de **consulta** (listagem, detalhe), **atualização** ou **exclusão** de produtos; **upload de imagens**; **categorias**; alteração do contrato de emissão de JWT no **users-service**; novos papéis além de **`seller`** e **`buyer`** já existentes.

---

## 1. Requisitos funcionais

1. Deve existir um **ProductsService** responsável pela lógica de criação de produto no banco (persistência via TypeORM na entidade **Product**), orquestrada de forma coerente com o restante do módulo de produtos.

2. Deve existir um **ProductsController** expondo o endpoint de criação conforme esta spec.

3. O **ProductsModule** deve **registrar** e **encadear** **ProductsController** e **ProductsService** (e dependências necessárias ao TypeORM para **Product**), de modo que a rota fique disponível na aplicação após o bootstrap.

4. Deve existir um endpoint **`POST /products`** que:
   - Aceita no corpo da requisição **apenas** os dados de criação descritos na seção **2** (sem **`sellerId`**).
   - **Não** é rota pública: **não** deve usar **`@Public()`**; a autenticação JWT continua obrigatória via guard global.
   - Antes de persistir, verifica se **`req.user.role`** é exatamente **`seller`**. Se **não** for (por exemplo **`buyer`** ou valor inesperado tratado como não autorizado para esta operação), a operação **não** cria registro e a resposta deve ser **403 Forbidden** conforme seção **3**.
   - Define **`sellerId`** do novo registro como **`req.user.id`** do token validado — **sem** ler **`sellerId`** do body.
   - Define **`isActive`** como **`true`** automaticamente na criação, **independentemente** de qualquer valor eventualmente enviado no body (o contrato de entrada **não** inclui **`isActive`**; ver seção **2**).
   - Persiste **name**, **description**, **price**, **stock** conforme validados; **createdAt** e **updatedAt** seguem as regras já estabelecidas pela entidade e pelo banco (geração automática ou equivalente já adotado no projeto).

5. **Validação de entrada:** os campos do corpo devem ser validados com regras da seção **2**. Respostas **400 Bad Request** devem ocorrer quando os dados forem inválidos, com **mensagens de erro claras** para o cliente (por exemplo indicação de campo e motivo, alinhado ao padrão de validação do NestJS no projeto — **ValidationPipe**, DTOs, etc., sem prescrever implementação neste documento).

6. **Segurança de contrato:** qualquer tentativa de enviar **`sellerId`**, **`isActive`** ou outros campos não previstos na seção **2** no body **não** deve permitir que o cliente **fixe** vendedor ou estado ativo: o servidor **ignora** ou **rejeita** conforme política do projeto (whitelist de propriedades no DTO), desde que o resultado final respeite **`sellerId`** e **`isActive`** conforme os itens acima.

---

## 2. Estrutura de dados — contrato de criação (sem `sellerId`)

O payload de **`POST /products`** contém **somente** os campos abaixo. Todos são **obrigatórios**.

| Campo | Tipo lógico | Regras |
|-------|-------------|--------|
| **name** | texto | Obrigatório; comprimento máximo **255** caracteres. |
| **description** | texto | Obrigatório; texto livre (sem limite máximo prescrito nesta spec além do que o tipo/coluna do banco suportar). |
| **price** | número decimal | Obrigatório; representação monetária com até **duas** casas decimais; valor **mínimo** **0,01** (não aceitar zero nem negativos para criação neste endpoint). |
| **stock** | número inteiro | Obrigatório; valor **mínimo** **0**. |

**Não** constam no contrato de entrada: **`sellerId`**, **`isActive`**, **`id`**, **`createdAt`**, **`updatedAt`**.

---

## 3. Respostas esperadas

| Código | Situação |
|--------|----------|
| **201 Created** | Produto criado com sucesso. O corpo da resposta deve permitir ao cliente identificar o recurso criado (por exemplo inclusão de **id** e demais campos persistidos relevantes, alinhado ao padrão REST do projeto). O cabeçalho **`Location`** é opcional nesta spec, salvo o plano de implementação decidir padronizá-lo. |
| **400 Bad Request** | Dados inválidos (validação falhou): campos ausentes, tipos incorretos, limites violados (por exemplo nome acima de 255 caracteres, preço abaixo de 0,01, estoque negativo, etc.). Mensagens **claras** conforme requisito funcional **1.5**. |
| **401 Unauthorized** | Sem token **`Authorization`**, token ausente quando obrigatório, token inválido ou expirado — **mesmo** comportamento já garantido pelo **JwtAuthGuard** global em rotas não públicas. |
| **403 Forbidden** | Token válido e autenticado, porém **`req.user.role`** **não** é **`seller`** (por exemplo **`buyer`**). **Não** confundir com **401**: aqui o usuário está identificado, mas **não** tem permissão para criar produto. |

---

## 4. Fluxo esperado (referência)

1. Requisição **`POST /products`** com **`Authorization: Bearer <token>`** e corpo JSON com os quatro campos contratuais.
2. Guard global valida JWT; se falhar → **401**.
3. Handler/controller (ou camada imediatamente após autenticação) verifica **`req.user.role === 'seller'`**; se falso → **403** (sem insert).
4. Validação do DTO/corpo; se inválido → **400**.
5. Montagem da entidade (ou comando de persistência) com **`sellerId = req.user.id`**, **`isActive = true`**, demais campos do body validados → insert → **201** com representação do produto criado.

---

## 5. Critérios de aceite (claros e testáveis)

1. **Módulo e rota:** com a aplicação em execução e banco acessível, **`POST /products`** está registrado e responde (não **404** por rota inexistente) quando chamado com método e path corretos.

2. **Autenticação obrigatória:** chamada **sem** cabeçalho **`Authorization`** (ou sem token válido) retorna **401**, não **201** nem **403** por papel.

3. **Papel seller:** requisição com JWT válido cujo **`role`** no payload seja **`seller`**, corpo válido, resulta em **201** e registro no banco com **`sellerId`** igual ao **id** do usuário do token (verificável por consulta ao banco ou por corpo de resposta que inclua **`sellerId`**).

4. **Papel buyer:** requisição com JWT válido cujo **`role`** seja **`buyer`**, mesmo com corpo válido, retorna **403** e **nenhum** novo registro de produto é criado para aquele payload.

5. **`sellerId` não vem do body:** teste (manual ou automatizado) que envia **`sellerId`** propositalmente no JSON com valor diferente do usuário autenticado: o produto persistido **não** deve usar esse valor; deve usar **`req.user.id`** do token **seller**.

6. **`isActive` automático:** produto criado via fluxo bem-sucedido possui **`isActive`** **true** no banco, sem o cliente precisar (ou poder) definir via body.

7. **Validação e 400:** cenários documentados na seção **2** (nome vazio, nome com mais de 255 caracteres, **price** 0 ou negativo, **price** com mais de duas casas decimais se a regra do projeto assim validar, **stock** negativo, **stock** não inteiro, campo obrigatório ausente) produzem **400** com mensagens compreensíveis (pelo menos indicação do campo problemático).

8. **Escopo único:** não existem nesta entrega endpoints **`GET`**, **`PATCH`/`PUT`**, **`DELETE`** para produtos além do que já existia antes desta spec; não há funcionalidade de imagem ou categoria acoplada a **`POST /products`**.

---

## 6. Dependências e rastreabilidade

- **Depende de:** spec **02** (JWT global, **`req.user`** com **id**/**email**/**role**); entidade **Product** e TypeORM configurados; **users-service** emitindo tokens com **`role`** **`seller`** ou **`buyer`**.
- **Complementada por:** specs futuras para leitura, atualização e exclusão de produtos; possíveis regras adicionais de negócio (aprovação, marketplace, etc.).

---

## 7. Ordem sugerida para o plano de implementação (referência, sem código)

1. Definir DTO de criação e regras de validação alinhadas à seção **2**.
2. Implementar **ProductsService** (criação persistida com **`sellerId`** e **`isActive`** conforme seção **1**).
3. Implementar **ProductsController** com **`POST /products`**, checagem de **`role`**, chamada ao service.
4. Registrar **ProductsModule** na aplicação (imports TypeORM, controllers, providers).
5. Cobrir critérios da seção **5** com testes (e2e ou integração), incluindo tokens **seller** e **buyer** e casos de validação.
