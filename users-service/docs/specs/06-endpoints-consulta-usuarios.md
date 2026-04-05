# Spec: endpoints de consulta de usuários (users-service)

## Contexto

O **users-service** já possui **NestJS**, **PostgreSQL**, entidade **`User`** com os campos **`id`**, **`email`**, **`password`**, **`firstName`**, **`lastName`**, **`role`**, **`status`**, **`createdAt`**, **`updatedAt`**, fluxo de **registro**, **login com JWT** e **proteção global de rotas** com **`JwtAuthGuard`** e decorator **`@Public()`** para exceções.

O **`UsersModule`** existe, porém **ainda não** expõe **`UsersController`** nem **`UsersService`** dedicados às operações de usuário além do que já estiver acoplado ao módulo de autenticação.

Em qualquer rota **não** marcada como pública, o cliente deve enviar um **JWT válido**; o guard trata **token ausente ou inválido** sem necessidade de regras adicionais nestes endpoints. O usuário autenticado fica disponível em **`req.user`** com pelo menos **`id`**, **`email`** e **`role`** (alinhado à spec **05-guards-jwt-protecao-rotas**).

**Fora de escopo desta spec:** **atualização** de perfil, **exclusão** de usuário, **listagem paginada** genérica, **alteração de senha**, **CRUD** completo de usuários, **RoleGuard** ou autorização por papel além do JWT obrigatório, **endpoints de administração** em massa.

**Não** inclui código neste documento — apenas **o quê** deve ser entregue, não **como** implementar.

---

## 1. Requisitos funcionais

### 1.1 `GET /users/profile`

1. O serviço deve expor **`GET /users/profile`**, **protegido por JWT** (sem **`@Public()`**).
2. A resposta de sucesso (**HTTP 200**) deve conter os **dados completos** do usuário **autenticado**, obtidos **consultando o banco de dados** pelo identificador **`req.user.id`** (garantindo dados **atualizados** em relação ao token).
3. O corpo da resposta **nunca** deve incluir o campo **`password`** (nem equivalente que exponha o segredo de autenticação).

### 1.2 `GET /users/sellers`

4. O serviço deve expor **`GET /users/sellers`**, **protegido por JWT**.
5. A resposta de sucesso (**HTTP 200**) deve ser uma **lista** de todos os usuários que satisfaçam **simultaneamente**:
   - **`role`** igual ao valor semântico de **vendedor** acordado no domínio (**`seller`**), e
   - **`status`** igual ao valor semântico de **conta ativa** acordado no domínio (**`active`**).
6. O contrato desta lista é destinado ao **consumo pelo frontend** e pelo **products-service** para **listar vendedores** elegíveis no marketplace.
7. Nenhum item da lista pode incluir o campo **`password`**.

### 1.3 `GET /users/:id`

8. O serviço deve expor **`GET /users/:id`**, **protegido por JWT**, onde **`:id`** é o **UUID** do usuário.
9. Se existir usuário com esse **`id`**, a resposta deve ser **HTTP 200** com os **dados desse usuário**, **sem** o campo **`password`**.
10. Se **não** existir usuário com o **`id`** informado, a resposta deve ser **HTTP 404** (usuário não encontrado).

### 1.4 Ordem das rotas no controlador

11. As rotas **estáticas** **`GET /users/profile`** e **`GET /users/sellers`** devem ser **declaradas antes** da rota dinâmica **`GET /users/:id`**, de forma que **`profile`** e **`sellers`** **nunca** sejam interpretados como valor do parâmetro **`:id`**.

### 1.5 Módulo, serviço e controlador

12. Deve existir um **`UsersService`** responsável pela **lógica de consulta** ao repositório / persistência para os três casos acima (perfil do logado, lista de sellers ativos, usuário por id).
13. Deve existir um **`UsersController`** que **mapeie** os três endpoints HTTP descritos e **delegue** as consultas ao **`UsersService`**.
14. O **`UsersModule`** deve **registrar** o **`UsersController`** e o **`UsersService`** (e quaisquer dependências necessárias para acesso aos dados de **`User`**, sem prescrever implementação técnica nesta spec).

---

## 2. Comportamento HTTP esperado

| Situação | Código HTTP | Observação |
|----------|-------------|------------|
| Consulta bem-sucedida (perfil, sellers ou usuário por id) | **200** | Corpo conforme seção 1; **sem** `password`. |
| Token ausente, malformado, inválido ou expirado | **401** | Tratado pelo **`JwtAuthGuard`** global; **não** exige lógica duplicada nos handlers desta spec. |
| **`GET /users/:id`** com id inexistente | **404** | **Apenas** este endpoint exige **404** explícito nesta spec. |

---

## 3. Critérios de aceite (testáveis)

1. **`GET /users/profile`** com JWT válido retorna **200** e um objeto de usuário cujos campos (exceto **`password`**) correspondem ao registro atual no banco para **`req.user.id`**; **`password`** está ausente.
2. **`GET /users/profile`** sem JWT ou com JWT inválido retorna **401** (comportamento do guard).
3. **`GET /users/sellers`** com JWT válido retorna **200** e um array; cada elemento tem **`role`** **`seller`** e **`status`** **`active`**; **`password`** está ausente em todos os elementos.
4. **`GET /users/sellers`** sem JWT ou com JWT inválido retorna **401**.
5. **`GET /users/:id`** com JWT válido e **id** de usuário existente retorna **200** e o usuário **sem** **`password`**.
6. **`GET /users/:id`** com JWT válido e **id** inexistente retorna **404**.
7. **`GET /users/:id`** sem JWT ou com JWT inválido retorna **401**.
8. Requisições a **`GET /users/profile`** e **`GET /users/sellers`** **não** são capturadas pela rota **`GET /users/:id`** (validação prática: **200** nas rotas corretas, não confusão com parâmetro **`:id`**).
9. **`UsersModule`** carrega **`UsersController`** e **`UsersService`** de forma que a aplicação inicie sem erro de injeção relacionado a estes componentes.

---

## 4. Dependências e alinhamento

- Payload JWT e **`req.user`**: spec **05-guards-jwt-protecao-rotas**.
- Modelo de dados **`User`** e enums / valores de **`role`** e **`status`**: entidade e migrações já existentes no serviço; esta spec assume que **`seller`** e **`active`** são os valores usados no domínio para vendedor ativo.
