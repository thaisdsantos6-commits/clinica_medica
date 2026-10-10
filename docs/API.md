# API

Base: `http://localhost:8080`. Corpo e respostas em JSON (UTF-8).

**Autenticação:** `POST /api/login` define o cookie `CLINICA_SESSAO` (`HttpOnly`, `SameSite=Strict`). Os demais endpoints exigem esse cookie; sem sessão válida respondem `401`.

**Erros** têm sempre o formato `{"error": "mensagem"}`.

| Status | Significado |
|---|---|
| `400` | Dado inválido ou JSON malformado (a mensagem explica) |
| `401` | Sem sessão / sessão expirada / credenciais inválidas |
| `404` | Recurso não encontrado |
| `405` | Método não permitido nesta URL |
| `500` | Erro interno inesperado |

---

## Autenticação

### `POST /api/login` — entrar

Enviado: `{"login": "admin", "senha": "123456"}`

Resposta `200`: `{"login": "admin", "papel": "ADMIN"}` + cabeçalho `Set-Cookie`.
Erros: `400` (campos vazios ou grandes demais), `401` (`Login ou senha inválidos.`).

### `POST /api/logout` — sair

Sem corpo. Resposta `200`: `{"ok": true}`. Invalida a sessão no servidor e limpa o cookie.

---

## Pacientes

### `GET /api/patients` — listar

Resposta `200`: lista de pacientes.

```json
[{"id": 1, "nome": "Ana Souza", "cpf": "52998224725", "convenio": "Unimed", "foto": null}]
```

`cpf` vem apenas com dígitos. `foto` é `null` ou uma data URL (`data:image/jpeg;base64,...`).

### `POST /api/patients` — cadastrar

Enviado: `{"nome": "Ana Souza", "cpf": "52998224725", "convenio": "Unimed", "foto": null}`
(`cpf` aceita com ou sem máscara; `foto` é opcional.)

Resposta `201`: o paciente criado (mesmo formato acima).
Erros `400`: campos obrigatórios, tamanho máximo, CPF inválido ou já cadastrado, foto inválida.

### `DELETE /api/patients/{id}` — excluir

Resposta `200`: `{"ok": true}`. Remove também as consultas do paciente. `404` se não existir.

---

## Consultas

### `GET /api/appointments` — listar

Resposta `200`:

```json
[{
  "id": 1,
  "paciente": {"id": 1, "nome": "Ana Souza", "cpf": "52998224725", "convenio": "Unimed"},
  "medico": "Dra. Camila Rocha",
  "dataHora": "2026-10-08T09:15:00",
  "status": "AGENDADA"
}]
```

### `POST /api/appointments` — agendar

Enviado: `{"pacienteId": 1, "medico": "Dra. Camila Rocha", "dataHora": "2026-10-08T09:15"}`

Resposta `201`: a consulta criada (formato acima).
Erros: `400` (médico vazio ou > 80 caracteres, data inválida, data no passado, médico já ocupado no horário), `404` (paciente inexistente).

### `PUT /api/appointments/{id}` — reagendar

Enviado: `{"dataHora": "2026-10-09T10:00"}`

Resposta `200`: a consulta atualizada. Erros: `400` (data inválida, no passado ou conflito de horário do médico), `404` (consulta inexistente).

---

## Arquivos estáticos

`GET /` e `GET /{arquivo}` servem a pasta `frontend/` (`index.html`, `app.js`, `style.css`). Caminhos fora dessa pasta retornam `404`.
