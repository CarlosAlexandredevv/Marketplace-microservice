# Spec: consulta de produtos — catálogo público (`GET /products`, `GET /products/seller/:sellerId`, `GET /products/:id`)

## Contexto

O **products-service** (porta **3001**) já possui scaffold **NestJS**, **PostgreSQL**, **TypeORM** com entidade **Product** (campos: **id**, **name**, **description**, **price**, **stock**, **sellerId**, **isActive**, **createdAt**, **updatedAt**), **autenticação JWT** com **guard global**, decorator **`@Public()`** para rotas sem autenticação, e endpoint **`POST /products`** (apenas **seller**) operacional.

O **ProductsModule** já expõe **ProductsController** e **ProductsService** com capacidade de **criação** de produto. Todas as rotas permanecem protegidas por padrão pelo **JwtAuthGuard**, exceto onde **`@Public()`** for aplicado explicitamente.

Esta spec cobre **somente** os endpoints essenciais de **consulta** para o funcionamento do marketplace: catálogo aberto para navegação, listagem por vendedor e detalhe por identificador.

**Não** inclui código neste documento — apenas **o quê** deve ser entregue, não **como** implementar.

**Fora de escopo:** **atualização** ou **exclusão** de produtos; **paginação**; **filtros** adicionais; **busca por texto**; alteração do contrato de **`POST /products`**; novos papéis ou mudanças no fluxo de emissão de JWT.

---

## 1. Requisitos funcionais

### 1.1 Visão geral

1. O **ProductsService** deve passar a oferecer as operações de leitura descritas abaixo (ou equivalente coerente no mesmo módulo), reutilizando a entidade **Product** e o acesso ao banco já existentes.

2. O **ProductsController** deve expor os três endpoints **`GET`** desta spec, mantendo **`POST /products`** como está (protegido, **seller** apenas), salvo ajustes estritamente necessários ao encadeamento de rotas (ver seção **2**).

3. As três rotas de consulta são **públicas**: cada uma deve ser decorada com **`@Public()`** para que **não** exijam token JWT. A criação (**`POST /products`**) **continua sem** **`@Public()`** e **permanece** protegida pelo guard global.

### 1.2 `GET /products`

- Retorna **todos** os produtos cuja coluna **`isActive`** seja **`true`**.
- A lista deve estar **ordenada por data de criação** (**`createdAt`**), com os **mais recentes primeiro**.
- Resposta de sucesso: **200 OK** com corpo representando a **lista** de produtos (pode ser array vazio se não houver produtos ativos).

### 1.3 `GET /products/seller/:sellerId`

- O parâmetro de rota **`sellerId`** identifica o vendedor (mesmo conceito de **`sellerId`** já usado na entidade **Product**).
- Retorna **todos** os produtos **ativos** (**`isActive === true`**) cujo **`sellerId`** corresponda ao valor informado na URL.
- Rota **pública** (**`@Public()`**).
- Se o vendedor não tiver produtos ativos (ou não existir nenhum registro que satisfaça o critério), a resposta deve ser **200 OK** com **array vazio** — **não** é obrigatório distinguir “vendedor inexistente” de “sem produtos” nesta spec.

### 1.4 `GET /products/:id`

- O parâmetro de rota **`id`** é o identificador do produto no formato **UUID**, alinhado ao tipo do campo **`id`** da entidade **Product**.
- Retorna os **dados do produto** correspondente quando existir registro com esse **`id`**.
- Rota **pública** (**`@Public()`**).
- Se **não** existir produto com o **`id`** informado, a resposta deve ser **404 Not Found** (corpo de erro alinhado ao padrão de exceções HTTP do NestJS no projeto).
- Se existir registro com o **`id`** informado, a resposta deve ser **200 OK** com os dados desse produto.

### 1.5 Formato da representação do produto

O corpo de resposta de cada endpoint deve expor os campos persistidos relevantes do **Product** (**id**, **name**, **description**, **price**, **stock**, **sellerId**, **isActive**, **createdAt**, **updatedAt** ou subconjunto alinhado ao que **`POST /products`** já devolve), de forma **consistente** entre listagem e detalhe, salvo decisão explícita no plano de implementação.

---

## 2. Regras importantes — ordem das rotas

No **NestJS** (e em frameworks similares), a **ordem de registro** das rotas **`GET`** no **ProductsController** **importa**:

1. Rotas **estáticas** e rotas com **prefixos literais** fixos devem ser declaradas **antes** da rota dinâmica que captura **`:id`**.
2. Em particular, **`GET /products/seller/:sellerId`** deve aparecer **antes** de **`GET /products/:id`**, para que o segmento **`seller`** não seja interpretado como um UUID de produto.

Recomenda-se manter **`GET /products`** (path exato) na posição que o time considerar mais legível, desde que **`.../seller/:sellerId`** preceda **`.../:id`**.

---

## 3. Respostas esperadas

| Código | Situação |
|--------|----------|
| **200 OK** | **`GET /products`**: lista de produtos ativos ordenados por **`createdAt`** descendente (pode ser lista vazia). |
| **200 OK** | **`GET /products/seller/:sellerId`**: lista de produtos ativos daquele vendedor (pode ser lista vazia). |
| **200 OK** | **`GET /products/:id`**: corpo com os dados do produto encontrado. |
| **404 Not Found** | **`GET /products/:id`** quando **não** existir produto com o **`id`** informado. **Não** se aplica aos dois **`GET`** de listagem (estes retornam lista vazia quando aplicável). |

**Não** são requisitos desta spec códigos **401** nas rotas públicas quando o cliente **não** envia token (o comportamento deve seguir a configuração atual do **`@Public()`** no projeto — tipicamente **200** com acesso permitido sem autenticação).

---

## 4. Critérios de aceite (claros e testáveis)

1. **`GET /products` sem autenticação** retorna **200** e um array (possivelmente vazio). Com produtos ativos e inativos no banco, **apenas** os com **`isActive` true** aparecem na lista.

2. **Ordenação:** dados de teste com **`createdAt`** distintos confirmam que o primeiro item da lista de **`GET /products`** é o **mais recente** entre os ativos.

3. **`GET /products/seller/:sellerId` sem autenticação** retorna **200** e array contendo **somente** produtos ativos cujo **`sellerId`** coincide com o parâmetro; **`sellerId`** inexistente ou sem produtos → **200** com array **vazio**.

4. **Ordem de rotas:** uma requisição para um path do tipo **`/products/seller/<uuid-válido>`** é tratada pelo handler de **vendedor**, **não** pelo handler de detalhe por **`id`** (verificável por resposta coerente com listagem por vendedor, não **404** “produto” indevido).

5. **`GET /products/:id` com UUID existente** retorna **200** e corpo com dados do produto.

6. **`GET /products/:id` com UUID inexistente** retorna **404** (e **não** **200** com corpo vazio).

7. **`POST /products`** continua exigindo JWT válido de **seller** e **não** foi tornado público; **`GET`** de consulta **não** exigem token.

8. **Escopo:** não há endpoints **`PUT`/`PATCH`/`DELETE`** nem **paginação**, **filtros** ou **busca textual** introduzidos por esta entrega.

---

## 5. Dependências e rastreabilidade

- **Depende de:** spec **03** (criação **`POST /products`**), entidade **Product**, TypeORM, **`@Public()`** e guard JWT global já configurados.
- **Complementada por:** specs futuras para atualização, exclusão, paginação ou busca, se necessário.

---

## 6. Ordem sugerida para o plano de implementação (referência, sem código)

1. Estender **ProductsService** com as três operações de leitura e critérios de filtro/ordenação desta spec.
2. Adicionar métodos **`GET`** no **ProductsController** com **`@Public()`**, respeitando a **ordem das rotas** da seção **2**.
3. Validar parâmetros de rota (**UUID** em **`id`**) conforme padrão do projeto, com **404** ou **400** alinhado à convenção escolhida no plano — desde que **UUID inexistente** em **`GET /products/:id`** resulte em **404**.
4. Cobrir os critérios da seção **4** com testes (e2e ou integração).
