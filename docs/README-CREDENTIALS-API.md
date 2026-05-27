# OIMED API - Sistema de Credenciais

## Descrição
Sistema de gerenciamento de credenciais (API Keys) para parceiros. Gera automaticamente `api_key` e `secret_key` para autenticação via Bearer Token.

---

## Schema - tb_credentialsApi.js

### Tabela: `oi_credentials`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | Primary Key, Auto Increment |
| id_franqueado | INTEGER | ID do parceiro/franqueado |
| nome | VARCHAR(100) | Nome da credencial |
| modo | VARCHAR(8) | `sandbox` ou `producao` |
| api_key | VARCHAR(255) | Chave pública (16 bytes hex) |
| secret_key | VARCHAR(500) | Chave secreta (32 bytes hex) |
| status | VARCHAR(10) | Status da credencial |
| createdAt | DATETIME | Data de criação |
| updatedAt | DATETIME | Data de atualização |

---

## Endpoints - CredentialsApi

### Listar Credenciais
```
GET /api/credentialsApi
GET /api/credentialsApi?id_franqueado={id}
```
**Resposta:**
```json
[
  {
    "id": 1,
    "id_franqueado": 12,
    "nome": "jose",
    "modo": "producao",
    "api_key": "a1b2c3d4e5f6g7h8",
    "secret_key": "secret123...",
    "status": "ativo",
    "createdAt": "2026-05-27T12:00:00.000Z",
    "updatedAt": "2026-05-27T12:00:00.000Z"
  }
]
```

### Buscar por ID
```
GET /api/credentialsApi/:id
```

### Criar Credencial
```
POST /api/credentialsApi
Content-Type: application/json
Authorization: Bearer {token}

{
  "id_franqueado": 12,
  "nome": "nomeParceiro",
  "modo": "producao"
}
```
**Resposta:**
```json
{
  "id": 19,
  "id_franqueado": 12,
  "nome": "nomeParceiro",
  "modo": "producao",
  "api_key": "gerado-automaticamente-16bytes",
  "secret_key": "gerado-automaticamente-32bytes",
  "status": "ativo",
  "createdAt": "2026-05-27T15:15:03.000Z",
  "updatedAt": "2026-05-27T15:15:03.000Z"
}
```

### Atualizar Credencial
```
PUT /api/credentialsApi/:id
Content-Type: application/json
Authorization: Bearer {token}

{
  "nome": "novoNome",
  "modo": "sandbox"
}
```

### Deletar Credencial
```
DELETE /api/credentialsApi/:id
Authorization: Bearer {token}
```
**Resposta:** `204 No Content`

---

## Autenticação

O token JWT deve ser enviado no header de todas as requisições:
```
Authorization: Bearer {token}
```

O token é gerado no endpoint `/api/auth` e armazenado no `sessionStorage` com a chave `oimedinttoken`.

---

## Frontend - Painel Parceiros

### Localização
- **Views:** `/views/parceiros/index.html`
- **JavaScript:** `/assets/js/parceiros.js`

### Funcionalidades

#### 1. Gerar Credenciais
Ação no dropdown de cada parceiro na tabela.

**Fluxo:**
1. Usuário clica em "Gerar Credenciais" no dropdown
2. Abre modal perguntando se quer `Sandbox` ou `Produção`
3. Mostra feedback visual (spinner) durante geração
4. Exibe modal com as credenciais criadas + botão copiar

**Funções JavaScript:**
- `openModalGerarCredenciais(id, nome)` - Abre dialog de seleção
- `gerarCredenciais(modo)` - POST para API, exibe loading, mostra resultado

#### 2. Ver Credenciais
Ação no dropdown de cada parceiro.

**Fluxo:**
1. Usuário clica em "Ver Credenciais" no dropdown
2. Abre modal listando todas as credenciais do parceiro
3. Cada card contém: API URL, API Key, Secret Key + botão copiar
4. Botão "Excluir Credencial" em cada card (100% largura)

**Funções JavaScript:**
- `openModalVerCredenciais(id, nome)` - Lista credenciais do parceiro
- `copiarCredencial(inputId)` - Copia para clipboard
- `deletarCredencial(id)` - Deleta com confirmação

### Modais

| Modal | ID | Função |
|-------|-----|--------|
| Gerar Credenciais | `#modalGerarCredenciais` | Seleção sandbox/produção |
| Loading | `#modalLoadingCredenciais` | Spinner durante geração |
| Ver Credenciais | `#modalVerCredenciais` | Lista e gerencia credenciais |

---

## Database - MySQL

### Criar Tabela
```sql
CREATE TABLE oi_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_franqueado INT NOT NULL,
    nome VARCHAR(100) NOT NULL,
    modo VARCHAR(8) NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    secret_key VARCHAR(500) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'ativo',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Inserir dados iniciais
```sql
INSERT INTO oi_credentials (id, id_franqueado, nome, modo, api_key, secret_key, status) VALUES
(12, 12, 'jose', 'producao', 'keytesteProd', 'secrettesteProd', 'ativo'),
(13, 13, 'abcbr', 'producao', 'abcbrkey', 'abcbrb16aje1w-d!1v1#kb99q(nvwbrn$sxalsoq06^odr9r%kebu#5', 'ativo'),
(14, 14, 'masterprev', 'producao', 'masterprevkey', '0d16946522cb04d7facbdb564c56403506bedf529a6e023f04f202b74d5d7874', 'ativo'),
(15, 15, 'aasap', 'producao', 'aasapkey', 'aasapfbe24a66442881c80232c0d1794a336d36746e124554cd9bfeea579492eac3ed', 'ativo'),
(17, 17, 'psamir', 'producao', '7YbTq8dn4ShBfSTEGaX9ZbUWYXp', '4a66442881c80232c0d1794a336d36746e124554cd9bfeea579492eac3ed-prod', 'ativo'),
(18, 18, 'psamir09', 'producao', 'hfgmy7856EGaX9ZbUWYXp', '4a664428km435tfci232c0d1794a336d36746e124554cd9bfeea579492eac3ed-prod', 'ativo'),
(19, 19, 'psamir53', 'producao', 'dfghr6btu567ShBf9ZbUWYXp', '4a66442881c80232c0d179iyg3hy3g5y6d36746e124554cd9bfeea579492eac3ed-prod', 'ativo'),
(20, 20, 'psamir54', 'producao', 'dfghr6btu567ShBf9Zb5345', '4a66442881c80232c0d179iyg3hy3g5y6d36746e124554cd9bfeea3243456uhy34g5d-prod', 'ativo');
```

### Corrigir Timezone (Brasil -03:00)
```sql
SET GLOBAL time_zone = '-03:00';
```
Ou no `my.cnf`/`my.ini`:
```ini
[mysqld]
default-time-zone = '-03:00'
```

---

## Arquivos do Projeto

### Backend (oimed-homolog)
```
schema/tb_credentialsApi.js          # Schema Sequelize
controllers/integracoes/apiKeys/      # Controller CRUD
routs/Routes.js                      # Rotas (importado via credentialsApiController)
```

### Frontend (parceiro.painelw.com.br)
```
views/parceiros/index.html            # Modais HTML
assets/js/parceiros.js                # Funções JS (dropdown actions, modais, etc)
```

---

## Changelog

### 2026-05-27

#### Adicionado
- Schema `tb_credentialsApi.js` com timestamps (createdAt, updatedAt)
- Controller CRUD em `controllers/integracoes/apiKeys/credentialsApiController.js`
- Endpoints REST para CredentialsApi
- Geração automática de `api_key` (16 bytes) e `secret_key` (32 bytes)
- Dropdown "Gerar Credenciais" no painel de parceiros
- Dropdown "Ver Credenciais" no painel de parceiros
- Modal de seleção Sandbox/Produção
- Modal de visualização com botões de copiar
- Função de deletar credenciais com confirmação
- Feedback visual (spinner) durante carregamento

#### Modificado
- `Routes.js` - Importado controller e adicionado endpoints
- `tb_credentialsApi.js` - Exportação direta do modelo (não mais função)
- `store` - Gera api_key e secret_key automaticamente
- `index` - Aceita filtro por `id_franqueado`

---

## Configuração de Ambiente

### URL da API (config.js)
```javascript
baseUrl: 'http://localhost:3035/api'
```

### Headers Necessários
```javascript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer {token}'
}
```

---

## Próximas Melhorias
- [ ] Adicionar campo `descricao` para identificar finalidade da credencial
- [ ] Implementar rate limiting por api_key
- [ ] Adicionar logs de uso das credenciais
- [ ] Criar endpoint para regenerar chaves