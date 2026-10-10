/* Clínica Médica — interface web (Centro de Saúde Vitalis)
   Seções, na ordem: 1 Estado · 2 Utilidades · 3 API · 4 Formatação · 5 Navegação ·
   6 Carregamento · 7 Renderização · 8 Cadastro · 9 Exclusão · 10 Agendamento ·
   11 Login/autenticação · 12 Inicialização. */
(() => {
'use strict';

/* =====================================================================
   1. ESTADO DA APLICAÇÃO
   Somente em memória: nada sensível vai para localStorage.
   Os demais estados locais (falhas de login, foto em edição, consulta em
   reagendamento) ficam junto da seção que os usa.
   ===================================================================== */
const CONFIG = {
  MODO: location.protocol === 'file:' ? 'demo' : 'api',
  // 'api': usa o backend Java (padrão quando servido em http://localhost:8080).
  // 'demo': dados fictícios só no navegador, sem backend.
  BASE_URL: '',                        // vazio = mesma origem: o ApiServer serve o front e a API em http://localhost:8080
  INATIVIDADE_MS: 10 * 60 * 1000,
  MAX_TENTATIVAS: 5,
  BLOQUEIO_S: 30
};

let sessao = null, pacientes = [], consultas = [], viewAtual = 'inicio', ultimoFoco = null;

/* =====================================================================
   2. SELETORES E UTILIDADES (sempre textContent: nunca innerHTML com dados)
   ===================================================================== */
const delay = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');
const isoLocal = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const digitos = s => String(s).replace(/\D/g, '');

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
  return el;
}
const ICONS = {
  home:'<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.3 2.9-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.2c2.3.2 3.7 1.7 4.2 4.3"/>',
  calendar:'<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M8 3.5v4M16 3.5v4M4 10.5h16"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  logout:'<path d="M10 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h3"/><path d="M14 8l4 4-4 4M18 12H9.5"/>',
  eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeoff:'<path d="M4 4l16 16"/><path d="M9.6 6.1A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4M6.4 7.7A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  lock:'<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  camera:'<path d="M4 8.5A1.8 1.8 0 0 1 5.8 6.7h1.6L8.3 5h7.4l0.9 1.7h1.6A1.8 1.8 0 0 1 20 8.5v9A1.8 1.8 0 0 1 18.2 19H5.8A1.8 1.8 0 0 1 4 17.5Z"/><circle cx="12" cy="12.5" r="3.4"/>',
  reagendar:'<path d="M4 4.5v5h5"/><path d="M4.9 9.4a8 8 0 1 1 1.7 8.1"/>'
};
function icon(name, size = 20) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'ic');
  s.innerHTML = ICONS[name];               // conteúdo constante e confiável
  return s;
}
$$('[data-icon]').forEach(el => el.replaceWith(icon(el.dataset.icon, Number(el.dataset.size) || 20)));

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, um, varios) => n === 1 ? um : varios;
const semAcento = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const inicial = s => (s.trim()[0] || '?').toUpperCase();
function setMsg(el, txt, tipo = 'erro') { el.textContent = txt || ''; el.dataset.tipo = tipo; }
let toastT;
function toast(txt) { const t = $('#toast'); t.textContent = txt; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3800); }

/* =====================================================================
   3. COMUNICAÇÃO COM A API
   `Api` aponta para ApiHttp (backend Java) ou, em MODO 'demo', para ApiDemo
   (dados fictícios no navegador). O restante da interface só conversa com `Api`.
   As regras de negócio e a autenticação são decididas pelo servidor; o front
   apenas valida para dar retorno rápido e exibe o resultado.
   ===================================================================== */
class ErroNegocio extends Error {}
class ErroSessao extends Error {}

function cpfValido(cpf) {
  const d = digitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (let t = 9; t < 11; t++) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(d[t])) return false;
  }
  return true;
}
function cpfCom(base9) {
  const d = base9.split('').map(Number);
  for (let t = 9; t < 11; t++) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += d[i] * (t + 1 - i);
    d.push(((soma * 10) % 11) % 10);
  }
  return d.join('');
}

const demo = { pacientes: [], consultas: [], seqP: 1, seqC: 1 };
const ApiDemo = {
  async autenticar(login, senha) {
    await delay(400);
    return (login && senha) ? { login } : null;
  },
  async listarPacientes() {
    await delay(60);
    return demo.pacientes.map(p => ({ ...p }));
  },
  async cadastrarPaciente(nome, cpf, convenio, foto) {
    await delay(250);
    if (!nome || !cpf || !convenio) throw new ErroNegocio('Erro: todos os campos são obrigatórios.');
    const d = digitos(cpf);
    if (!cpfValido(d)) throw new ErroNegocio('CPF inválido: confira os 11 dígitos.');
    if (demo.pacientes.some(p => p.cpf === d)) throw new ErroNegocio('CPF inválido: já existe um paciente com este CPF.');
    const p = { id: demo.seqP++, nome, cpf: d, convenio, foto: foto || null };
    demo.pacientes.push(p);
    return { ...p };
  },
  async atualizarPaciente(id, nome, cpf, convenio, foto) {
    await delay(250);
    const paciente = demo.pacientes.find(p => p.id === id);
    if (!paciente) throw new ErroNegocio('Paciente não encontrado.');
    if (!nome || !cpf || !convenio) throw new ErroNegocio('Erro: todos os campos são obrigatórios.');
    const d = digitos(cpf);
    if (!cpfValido(d)) throw new ErroNegocio('CPF inválido: confira os 11 dígitos.');
    if (demo.pacientes.some(p => p.id !== id && p.cpf === d)) throw new ErroNegocio('CPF inválido: já existe um paciente com este CPF.');
    Object.assign(paciente, { nome, cpf: d, convenio, foto: foto || null });
    return { ...paciente };
  },
  async removerPaciente(id) {
    await delay(180);
    const paciente = demo.pacientes.find(p => p.id === id);
    if (!paciente) throw new ErroNegocio('Paciente não encontrado.');
    demo.pacientes = demo.pacientes.filter(p => p.id !== id);
    demo.consultas = demo.consultas.filter(c => c.pacienteId !== id);
    return { ok: true, paciente };
  },
  async listarConsultas() {
    await delay(60);
    return demo.consultas.map(c => ({ ...c }));
  },
  async agendarConsulta(pacienteId, medico, dataHora, orcamentoCentavos) {
    await delay(250);
    const p = demo.pacientes.find(x => x.id === pacienteId);
    if (!p) throw new ErroNegocio('Paciente não encontrado.');
    if (!medico) throw new ErroNegocio('Erro: nome do médico é obrigatório.');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dataHora) || isNaN(new Date(dataHora))) throw new ErroNegocio('Formato inválido. Informe uma data e hora válidas.');
    if (new Date(dataHora) < new Date()) throw new ErroNegocio('A data da consulta deve ser no futuro.');
    if (demo.consultas.some(c => c.medico.toLowerCase() === medico.toLowerCase() && c.dataHora === dataHora)) {
      throw new ErroNegocio('Este médico já tem uma consulta neste horário.');
    }
    const c = { id: demo.seqC++, pacienteId: p.id, pacienteNome: p.nome, convenio: p.convenio, medico, dataHora, orcamentoCentavos };
    demo.consultas.push(c);
    return { ...c };
  },
  async atualizarOrcamento(consultaId, orcamentoCentavos) {
    await delay(180);
    const consulta = demo.consultas.find(c => c.id === consultaId);
    if (!consulta) throw new ErroNegocio('Consulta não encontrada.');
    if (orcamentoCentavos != null && (!Number.isSafeInteger(orcamentoCentavos) || orcamentoCentavos < 0)) {
      throw new ErroNegocio('Informe um orçamento válido, igual ou maior que zero.');
    }
    consulta.orcamentoCentavos = orcamentoCentavos;
    return { ...consulta };
  },
  async reagendarConsulta(consultaId, novaDataHora) {
    await delay(220);
    const c = demo.consultas.find(x => x.id === consultaId);
    if (!c) throw new ErroNegocio('Consulta não encontrada.');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(novaDataHora) || isNaN(new Date(novaDataHora))) throw new ErroNegocio('Formato inválido. Informe uma data e hora válidas.');
    if (new Date(novaDataHora) < new Date()) throw new ErroNegocio('A nova data deve ser no futuro.');
    if (demo.consultas.some(x => x.id !== consultaId && x.medico.toLowerCase() === c.medico.toLowerCase() && x.dataHora === novaDataHora)) {
      throw new ErroNegocio('Este médico já tem uma consulta neste horário.');
    }
    c.dataHora = novaDataHora;
    return { ...c };
  },
  _limpar() {
    demo.pacientes = [];
    demo.consultas = [];
    demo.seqP = 1;
    demo.seqC = 1;
  },
  _semear() {
    this._limpar();
    const base = [
      ['Marina Duarte Leal', '123456789', 'Unimed'],
      ['Carlos Eduardo Pinheiro', '987654321', 'Particular'],
      ['Helena Braga Matos', '246813579', 'Bradesco Saúde'],
      ['Otávio Nascimento', '135792468', 'SulAmérica'],
      ['Beatriz Cavalcante', '112233445', 'Amil']
    ];
    base.forEach(([n, b, c]) => demo.pacientes.push({ id: demo.seqP++, nome: n, cpf: cpfCom(b), convenio: c }));
    const quando = (dias, h, m) => {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      d.setHours(h, m, 0, 0);
      return isoLocal(d);
    };
    const em = min => {
      const d = new Date(Date.now() + min * 60000);
      d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
      return isoLocal(d);
    };
    [
      [1, 'Dra. Camila Rocha', em(95)],
      [2, 'Dr. Rafael Amorim', quando(1, 9, 30)],
      [3, 'Dra. Camila Rocha', quando(1, 10, 15)],
      [4, 'Dr. Rafael Amorim', quando(2, 14, 0)],
      [5, 'Dra. Camila Rocha', quando(4, 8, 45)]
    ].forEach(([pid, med, dt]) => {
      const p = demo.pacientes[pid - 1];
      demo.consultas.push({ id: demo.seqC++, pacienteId: p.id, pacienteNome: p.nome, convenio: p.convenio, medico: med, dataHora: dt });
    });
  }
};
ApiDemo._semear();

/* ---- Modo 'api': fala com o backend Java (ApiServer, baseado no HttpServer do JDK). ----
   Espelha a mesma interface do ApiDemo acima, então o resto da tela não muda em nada.
   Front e API são servidos pela mesma origem (http://localhost:8080), então não há CORS.
   A sessão é um cookie HttpOnly emitido pelo servidor em /api/login: o JavaScript
   nunca o lê, o navegador apenas o devolve em cada chamada. ------------------------- */
let aoExpirarSessao = null;     // definido na seção de login
async function chamarApi(caminho, opcoes = {}) {
  let resp;
  try {
    resp = await fetch(CONFIG.BASE_URL + caminho, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...opcoes
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor.');
  }
  let corpo = null;
  try { corpo = await resp.json(); } catch { /* respostas sem corpo, ex.: 204 */ }
  if (!resp.ok) {
    const mensagem = corpo && (corpo.error || corpo.mensagem) ? (corpo.error || corpo.mensagem) : 'Não foi possível concluir a operação.';
    if (resp.status === 401) {
      // sessão do servidor expirou (a tela de login não conta: ali 401 = credenciais inválidas)
      if (caminho !== '/api/login' && sessao && aoExpirarSessao) aoExpirarSessao();
      throw new ErroSessao(mensagem);
    }
    throw new ErroNegocio(mensagem);
  }
  return corpo;
}
// O servidor devolve {id, paciente:{id,nome,cpf,convenio}, medico, dataHora, status}.
// A interface trabalha com o formato achatado abaixo.
const consultaDoServidor = c => ({
  id: c.id,
  pacienteId: c.paciente.id,
  pacienteNome: c.paciente.nome,
  convenio: c.paciente.convenio,
  medico: c.medico,
  dataHora: c.dataHora.slice(0, 16),
  orcamentoCentavos: c.orcamentoCentavos == null ? null : c.orcamentoCentavos
});
const ApiHttp = {
  async autenticar(login, senha) {
    try {
      const r = await chamarApi('/api/login', { method: 'POST', body: JSON.stringify({ login, senha }) });
      return { login: r.login };
    } catch (e) {
      if (e instanceof ErroNegocio || e instanceof ErroSessao) return null;
      throw e;
    }
  },
  async sair() {
    try {
      await chamarApi('/api/logout', { method: 'POST' });
    } catch {
      // a sessão expira sozinha de qualquer forma
    }
  },
  async listarPacientes() {
    return chamarApi('/api/patients');
  },
  async cadastrarPaciente(nome, cpf, convenio, foto) {
    return chamarApi('/api/patients', { method: 'POST', body: JSON.stringify({ nome, cpf: digitos(cpf), convenio, foto: foto || null }) });
  },
  async atualizarPaciente(id, nome, cpf, convenio, foto) {
    return chamarApi(`/api/patients/${id}`, { method: 'PUT', body: JSON.stringify({ nome, cpf: digitos(cpf), convenio, foto: foto || null }) });
  },
  async removerPaciente(id) {
    return chamarApi(`/api/patients/${id}`, { method: 'DELETE' });
  },
  async listarConsultas() {
    const linhas = await chamarApi('/api/appointments');
    return linhas.map(consultaDoServidor);
  },
  async agendarConsulta(pacienteId, medico, dataHora, orcamentoCentavos) {
    return consultaDoServidor(await chamarApi('/api/appointments', { method: 'POST', body: JSON.stringify({ pacienteId, medico, dataHora, orcamentoCentavos }) }));
  },
  async atualizarOrcamento(consultaId, orcamentoCentavos) {
    return consultaDoServidor(await chamarApi(`/api/appointments/${consultaId}/budget`, {
      method: 'PUT', body: JSON.stringify({ orcamentoCentavos })
    }));
  },
  async reagendarConsulta(consultaId, novaDataHora) {
    return consultaDoServidor(await chamarApi(`/api/appointments/${consultaId}`, { method: 'PUT', body: JSON.stringify({ dataHora: novaDataHora }) }));
  }
};
const Api = CONFIG.MODO === 'api' ? ApiHttp : ApiDemo;

/* =====================================================================
   4. FORMATAÇÃO
   ===================================================================== */
const fmtCpf = d => `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
const mascaraCpf = d => `${d.slice(0,3)}.•••.•••-${d.slice(9,11)}`;
const fmtParcial = d => { let s = d.slice(0,3); if (d.length>3) s += '.'+d.slice(3,6); if (d.length>6) s += '.'+d.slice(6,9); if (d.length>9) s += '-'+d.slice(9,11); return s; };
const fmtDiaLongo = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDinheiroCentavos = centavos => fmtDinheiro.format(centavos / 100);
const fmtSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });
const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long' });
const inicioDia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diffDias = (a, b) => Math.round((inicioDia(a) - inicioDia(b)) / 86400000);
const ordenar = arr => [...arr].sort((a, b) => a.dataHora.localeCompare(b.dataHora));
function quando(dt) {
  const min = Math.round((dt - new Date()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `em ${min} min`;
  const dias = diffDias(dt, new Date());
  if (dias === 0) return `hoje, em ${Math.round(min / 60)} h`;
  if (dias === 1) return 'amanhã';
  return `em ${dias} dias`;
}

/* =====================================================================
   5. NAVEGAÇÃO
   ===================================================================== */
const VIEWS = {
  inicio:    { titulo: () => `Bem-vindo, ${sessao.login}!`, sub: () => cap(fmtDiaLongo.format(new Date())), acao: { txt: 'Agendar consulta', fazer: () => ir('consultas') } },
  pacientes: { titulo: () => 'Pacientes', sub: () => 'Cadastre e consulte quem é atendido na clínica.', acao: { txt: 'Novo paciente', fazer: () => abrirDialogo() } },
  consultas: { titulo: () => 'Consultas', sub: () => 'Agende por médico, data e hora e acompanhe a agenda.', acao: null }
};
function ir(v) {
  viewAtual = v;
  $$('.view').forEach(s => s.hidden = s.id !== 'v-' + v);
  $$('.nav-btn[data-view]').forEach(b => b.hasAttribute('data-view') && (b.dataset.view === v ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  const cfg = VIEWS[v];
  $('#titulo').textContent = cfg.titulo(); $('#subtitulo').textContent = cfg.sub();
  const b = $('#top-acao'); b.hidden = !cfg.acao; if (cfg.acao) b.lastElementChild.textContent = cfg.acao.txt;
  $('#main').scrollTop = 0; $('#titulo').focus({ preventScroll: true });
  if (v === 'consultas') prepararFormConsulta();
}
$$('.nav-btn[data-view]').forEach(b => b.addEventListener('click', () => ir(b.dataset.view)));
$$('[data-ir]').forEach(b => b.addEventListener('click', () => ir(b.dataset.ir)));
$('#top-acao').addEventListener('click', () => VIEWS[viewAtual].acao?.fazer());

$('#btn-tema').addEventListener('click', () => {
  const r = document.documentElement;
  const escuro = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = escuro ? 'light' : 'dark';
  $('#btn-tema').replaceChildren(icon(escuro ? 'moon' : 'sun'));
});
$('#btn-limpar').addEventListener('click', async () => {
  if (!confirm('Apagar os pacientes e consultas de exemplo?')) return;
  ApiDemo._limpar(); await carregar(); toast('Dados de exemplo removidos.');
});

/* =====================================================================
   6. CARREGAMENTO DE DADOS
   ===================================================================== */
async function carregar() {
  try { [pacientes, consultas] = await Promise.all([Api.listarPacientes(), Api.listarConsultas()]); }
  catch (err) { if (!(err instanceof ErroSessao)) toast('Não foi possível carregar os dados. Tente novamente.'); return; }
  renderInicio(); renderPacientes(); renderAgenda($('#consultas-agenda'), ordenar(consultas), 'Nenhuma consulta agendada.'); prepararFormConsulta();
}

/* =====================================================================
   7. RENDERIZAÇÃO
   ===================================================================== */
function renderInicio() {
  const agora = new Date();
  const futuras = ordenar(consultas).filter(c => new Date(c.dataHora) >= agora);
  const prox = futuras[0], corpo = $('#proxima-corpo');
  if (!prox) {
    const temPac = pacientes.length > 0;
    corpo.replaceChildren(
      h('p', { class: 'rotulo', text: 'Próxima consulta' }),
      h('p', { class: 'vazio-titulo', text: 'Agenda livre por enquanto.' }),
      h('p', { class: 'vazio-txt', text: temPac ? 'Nenhuma consulta agendada. Escolha um paciente e marque o primeiro horário.' : 'Cadastre o primeiro paciente para começar a agendar consultas.' }),
      h('button', { class: 'btn accent', type: 'button', onclick: () => temPac ? ir('consultas') : abrirDialogo() }, temPac ? 'Agendar consulta' : 'Cadastrar paciente')
    );
  } else {
    const d = new Date(prox.dataHora);
    corpo.replaceChildren(
      h('p', { class: 'rotulo', text: `Próxima consulta, ${quando(d)}` }),
      h('p', { class: 'hora-grande', text: fmtHora.format(d) }),
      h('p', { class: 'data-longa', text: cap(fmtDiaLongo.format(d)) }),
      h('p', { class: 'quem-grande', text: prox.pacienteNome }),
      h('p', { class: 'medico-claro', text: 'com ' + prox.medico })
    );
  }
  const hoje = futuras.filter(c => diffDias(new Date(c.dataHora), agora) === 0).length;
  const linha = (n, um, varios) => h('div', {}, h('b', { text: String(n) }), h('span', { text: plural(n, um, varios) }));
  $('#resumo').replaceChildren(
    linha(pacientes.length, 'paciente cadastrado', 'pacientes cadastrados'),
    linha(consultas.length, 'consulta agendada', 'consultas agendadas'),
    linha(hoje, 'consulta hoje', 'consultas hoje')
  );
  renderAgenda($('#inicio-agenda'), futuras.slice(0, 6), 'Nenhum atendimento à vista. Que tal agendar uma consulta?');
}

function renderAgenda(el, lista, vazioMsg) {
  if (!lista.length) { el.replaceChildren(h('p', { class: 'vazio-inline', text: vazioMsg })); return; }
  const grupos = new Map(), agora = new Date();
  for (const c of lista) { const k = c.dataHora.slice(0, 10); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(c); }
  el.replaceChildren(...[...grupos].map(([k, itens]) => {
    const d = new Date(k + 'T00:00'), dd = diffDias(d, agora);
    const rotulo = dd === 0 ? 'Hoje' : dd === 1 ? 'Amanhã' : cap(fmtSemana.format(d));
    return h('div', { class: 'dia' + (dd === 0 ? ' hoje' : '') },
      h('div', { class: 'dia-marca' }, String(d.getDate()), h('small', { text: rotulo }), h('small', { text: fmtMes.format(d) })),
      h('div', {}, itens.map(c => {
        const dt = new Date(c.dataHora), passada = dt < agora;
        return h('div', { class: 'consulta' + (passada ? ' passada' : '') },
          h('span', { class: 'hora', text: fmtHora.format(dt) }),
          h('div', {}, h('div', { class: 'quem', text: c.pacienteNome }), h('div', { class: 'medico', text: 'com ' + c.medico })),
          h('div', { class: 'consulta-acoes' },
            h('span', { class: 'chip', text: c.convenio }),
            h('span', { class: 'chip orcamento-chip', text: c.orcamentoCentavos == null ? 'Sem orçamento' : fmtDinheiroCentavos(c.orcamentoCentavos) }),
            h('button', { class: 'btn ghost consulta-orcamento', type: 'button',
              text: c.orcamentoCentavos == null ? 'Definir orçamento' : 'Editar orçamento',
              'aria-label': `${c.orcamentoCentavos == null ? 'Definir' : 'Editar'} orçamento da consulta de ${c.pacienteNome}`,
              onclick: () => abrirOrcamento(c) }),
            h('button', { class: 'icon-btn sm', type: 'button', disabled: passada,
              'aria-label': passada ? `Consulta de ${c.pacienteNome} já ocorreu` : `Reagendar consulta de ${c.pacienteNome}`,
              onclick: () => abrirReagendar(c) }, icon('reagendar', 17))));
      })));
  }));
}

function renderPacientes() {
  const area = $('#pacientes-area'), cont = $('#pacientes-contagem');

  if (!pacientes.length) {
    area.replaceChildren(
      h('div', { class: 'vazio-tabela tabela-wrap' },
        h('div', { class: 'vazio-bloco' },
          h('strong', { text: 'Nenhum paciente cadastrado.' }),
          h('span', { text: 'Cadastre o primeiro paciente para liberar o agendamento de consultas.' }),
          h('button', { class: 'btn primary', type: 'button', onclick: () => abrirDialogo() }, 'Cadastrar paciente')
        )
      )
    );
    cont.textContent = '';
    return;
  }

  const termo = semAcento($('#busca').value.trim());
  const lista = pacientes.filter(p => !termo || semAcento(`${p.nome} ${p.convenio} ${p.cpf} ${fmtCpf(p.cpf)}`).includes(termo));

  if (!lista.length) {
    area.replaceChildren(
      h('div', { class: 'tabela-wrap' },
        h('div', { class: 'vazio-bloco' },
          h('strong', { text: 'Nenhum paciente encontrado.' }),
          h('span', { text: `Nada corresponde a “${$('#busca').value.trim()}”. Confira a grafia ou busque por outro dado.` })
        )
      )
    );
    cont.textContent = '';
    return;
  }

  const linhas = lista.map(p => {
    const span = h('span', { class: 'cpf', text: mascaraCpf(p.cpf) });
    const btn = h('button', {
      class: 'icon-btn sm',
      type: 'button',
      'aria-pressed': 'false',
      'aria-label': `Mostrar CPF completo de ${p.nome}`
    });
    btn.append(icon('eye', 18));

    let t;
    const ocultar = () => {
      clearTimeout(t);
      span.textContent = mascaraCpf(p.cpf);
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', `Mostrar CPF completo de ${p.nome}`);
      btn.replaceChildren(icon('eye', 18));
    };

    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-pressed') === 'true') {
        ocultar();
        return;
      }
      span.textContent = fmtCpf(p.cpf);
      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', `Ocultar CPF de ${p.nome}`);
      btn.replaceChildren(icon('eyeoff', 18));
      t = setTimeout(ocultar, 8000);
    });

    const detalhes = h('button', {
      class: 'btn ghost',
      type: 'button',
      text: 'Detalhes',
      onclick: () => abrirDetalhesPaciente(p)
    });

    const editar = h('button', {
      class: 'btn ghost',
      type: 'button',
      text: 'Editar',
      onclick: () => abrirDialogo(p)
    });

    const remover = h('button', {
      class: 'btn ghost danger',
      type: 'button',
      text: 'Excluir',
      onclick: () => excluirPaciente(p)
    });

    return h('tr', {},
      h('td', {},
        h('div', { class: 'pessoa' },
          h('span', { class: 'avatar t' + (p.id % 3), 'aria-hidden': 'true' },
            p.foto ? h('img', { src: p.foto, alt: '' }) : inicial(p.nome)
          ),
          h('div', {},
            h('div', { class: 'nome', text: p.nome }),
            h('div', { class: 'sub', text: 'ID ' + p.id })
          )
        )
      ),
      h('td', { 'data-label': 'CPF' }, h('div', { class: 'cpf-cel' }, span, btn)),
      h('td', { 'data-label': 'Convênio' }, h('span', { class: 'chip', text: p.convenio })),
      h('td', { 'data-label': 'Ações' }, h('div', { class: 'acoes-inline' }, detalhes, editar, remover))
    );
  });

  area.replaceChildren(
    h('div', { class: 'tabela-wrap' },
      h('table', {},
        h('thead', {},
          h('tr', {},
            h('th', { scope: 'col', text: 'Paciente' }),
            h('th', { scope: 'col', text: 'CPF' }),
            h('th', { scope: 'col', text: 'Convênio' }),
            h('th', { scope: 'col', text: 'Ações' })
          )
        ),
        h('tbody', {}, linhas)
      )
    )
  );

  cont.textContent = `${lista.length} de ${pacientes.length} ${plural(pacientes.length, 'paciente', 'pacientes')}`;
}
$('#busca').addEventListener('input', renderPacientes);

const dlgDetalhes = $('#dlg-paciente-detalhes');
const dNome = $('#d-p-nome'), dCpf = $('#d-p-cpf'), dConvenio = $('#d-p-convenio');
const dFoto = $('#d-p-foto-preview'), dLetra = $('#d-p-foto-letra');
let pacienteDetalheAtual = null;

function abrirDetalhesPaciente(p) {
  pacienteDetalheAtual = p;
  dNome.textContent = p.nome;
  dCpf.textContent = fmtCpf(p.cpf);
  dConvenio.textContent = p.convenio;
  if (p.foto) {
    dFoto.src = p.foto;
    dFoto.hidden = false;
    dLetra.hidden = true;
  } else {
    dFoto.hidden = true;
    dFoto.src = '';
    dLetra.hidden = false;
    dLetra.textContent = inicial(p.nome);
  }
  dlgDetalhes.showModal();
}
$('#d-fechar').addEventListener('click', () => dlgDetalhes.close());
dlgDetalhes.addEventListener('click', e => { if (e.target === dlgDetalhes) dlgDetalhes.close(); });
$('#d-editar').addEventListener('click', () => {
  if (!pacienteDetalheAtual) return;
  const paciente = pacienteDetalheAtual;
  dlgDetalhes.close();
  abrirDialogo(paciente);
});
$('#d-excluir').addEventListener('click', async () => {
  if (!pacienteDetalheAtual) return;
  dlgDetalhes.close();
  await excluirPaciente(pacienteDetalheAtual);
  pacienteDetalheAtual = null;
});

/* =====================================================================
   8. CADASTRO DE PACIENTE
   ===================================================================== */
const dlg = $('#dlg-paciente'), formP = $('#form-paciente'), msgP = $('#msg-paciente'), inCpf = $('#p-cpf'), inNomeP = $('#p-nome');
const btnFoto = $('#p-foto-botao'), inFoto = $('#p-foto-arquivo'), imgFoto = $('#p-foto-preview'), letraFoto = $('#p-foto-letra'), btnRemoverFoto = $('#p-foto-remover');
const MAX_FOTO_MB = 8;
let fotoAtual = null, pacienteEditando = null;

function atualizarLetraFoto() { letraFoto.textContent = inNomeP.value.trim() ? inicial(inNomeP.value) : '?'; }
function resetarFoto() {
  fotoAtual = null; inFoto.value = '';
  imgFoto.hidden = true; imgFoto.src = ''; letraFoto.hidden = false; btnRemoverFoto.hidden = true;
  atualizarLetraFoto();
}
function redimensionarImagem(arquivo, maxLado = 320, qualidade = 0.85) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const largura = Math.round(img.width * escala) || 1, altura = Math.round(img.height * escala) || 1;
        const tela = document.createElement('canvas'); tela.width = largura; tela.height = altura;
        tela.getContext('2d').drawImage(img, 0, 0, largura, altura);
        resolve(tela.toDataURL('image/jpeg', qualidade));
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });
}

function abrirDialogo(paciente = null) {
  pacienteEditando = paciente;
  ultimoFoco = document.activeElement; formP.reset(); setMsg(msgP, ''); resetarFoto();
  $$('input', formP).forEach(i => i.removeAttribute('aria-invalid'));
  $('#dlg-titulo').textContent = paciente ? 'Editar paciente' : 'Novo paciente';
  $('#dlg-descricao').textContent = 'Nome, CPF e convênio são obrigatórios. A foto é opcional.';
  $('#p-salvar').textContent = paciente ? 'Salvar alterações' : 'Cadastrar paciente';
  if (paciente) {
    inNomeP.value = paciente.nome;
    inCpf.value = fmtCpf(paciente.cpf);
    $('#p-convenio').value = paciente.convenio;
    atualizarLetraFoto();
    if (paciente.foto) {
      fotoAtual = paciente.foto;
      imgFoto.src = paciente.foto;
      imgFoto.hidden = false;
      letraFoto.hidden = true;
      btnRemoverFoto.hidden = false;
    }
  }
  dlg.showModal(); $('#p-nome').focus();
}
dlg.addEventListener('close', () => { ultimoFoco && ultimoFoco.focus && ultimoFoco.focus(); });
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
$('#p-cancelar').addEventListener('click', () => dlg.close());
$('#btn-cadastrar-antes').addEventListener('click', () => abrirDialogo());
inCpf.addEventListener('input', () => { inCpf.value = fmtParcial(digitos(inCpf.value).slice(0, 11)); });
inNomeP.addEventListener('input', () => { if (!fotoAtual) atualizarLetraFoto(); });
btnFoto.addEventListener('click', () => inFoto.click());
btnRemoverFoto.addEventListener('click', () => resetarFoto());
inFoto.addEventListener('change', async () => {
  const arquivo = inFoto.files[0];
  if (!arquivo) return;
  if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type)) { setMsg(msgP, 'Envie uma foto em PNG, JPEG ou WebP.'); inFoto.value = ''; return; }
  if (arquivo.size > MAX_FOTO_MB * 1024 * 1024) { setMsg(msgP, `A foto deve ter até ${MAX_FOTO_MB} MB.`); inFoto.value = ''; return; }
  try {
    setMsg(msgP, '');
    fotoAtual = await redimensionarImagem(arquivo);
    imgFoto.src = fotoAtual; imgFoto.hidden = false; letraFoto.hidden = true; btnRemoverFoto.hidden = false;
  } catch { setMsg(msgP, 'Não foi possível usar essa foto. Tente outra.'); resetarFoto(); }
});

formP.addEventListener('submit', async e => {
  e.preventDefault();
  const campos = { nome: $('#p-nome'), cpf: inCpf, convenio: $('#p-convenio') };
  Object.values(campos).forEach(i => i.removeAttribute('aria-invalid'));
  const nome = campos.nome.value.trim(), cpf = campos.cpf.value.trim(), convenio = campos.convenio.value.trim();
  const vazios = Object.entries({ nome, cpf, convenio }).filter(([, v]) => !v).map(([k]) => k);
  if (vazios.length) { setMsg(msgP, 'Erro: todos os campos são obrigatórios.'); vazios.forEach(k => campos[k].setAttribute('aria-invalid', 'true')); campos[vazios[0]].focus(); return; }
  const editar = pacienteEditando;
  const salvar = $('#p-salvar'); salvar.disabled = true; salvar.textContent = editar ? 'Salvando…' : 'Cadastrando…'; setMsg(msgP, '');
  try {
    const p = editar
      ? await Api.atualizarPaciente(editar.id, nome, cpf, convenio, fotoAtual)
      : await Api.cadastrarPaciente(nome, cpf, convenio, fotoAtual);
    dlg.close(); pacienteEditando = null; await carregar();
    toast(editar ? `Cadastro atualizado: ${p.nome}` : `Paciente cadastrado: ${p.nome}`);
  } catch (err) {
    if (err instanceof ErroNegocio) { setMsg(msgP, err.message); if (/CPF/.test(err.message)) { inCpf.setAttribute('aria-invalid', 'true'); inCpf.focus(); } }
    else setMsg(msgP, editar ? 'Não foi possível atualizar o cadastro. Tente novamente.' : 'Não foi possível concluir o cadastro. Tente novamente.');
  } finally {
    salvar.disabled = false;
    salvar.textContent = pacienteEditando ? 'Salvar alterações' : 'Cadastrar paciente';
  }
});

/* =====================================================================
   9. EXCLUSÃO DE PACIENTE
   ===================================================================== */
async function excluirPaciente(p) {
  if (!confirm(`Excluir o cadastro de ${p.nome}?`)) return;
  try {
    await Api.removerPaciente(p.id);
    await carregar();
    toast(`Paciente excluído: ${p.nome}`);
  } catch (err) {
    toast(err instanceof ErroNegocio ? err.message : 'Não foi possível excluir o paciente.');
  }
}

/* =====================================================================
   10. AGENDAMENTO E REAGENDAMENTO DE CONSULTAS
   ===================================================================== */
const selPac = $('#c-paciente'), inMed = $('#c-medico'), inData = $('#c-data'), inOrcamento = $('#c-orcamento'), msgC = $('#msg-consulta');
function prepararFormConsulta() {
  const tem = pacientes.length > 0;
  $('#aviso-sem-paciente').hidden = tem; $('#fs-consulta').disabled = !tem;
  const atual = selPac.value;
  selPac.replaceChildren(h('option', { value: '', text: tem ? 'Selecione o paciente' : 'Sem pacientes' }),
    ...pacientes.map(p => h('option', { value: String(p.id), text: `${p.nome} (ID ${p.id})` })));
  if (pacientes.some(p => String(p.id) === atual)) selPac.value = atual;
  inData.min = isoLocal(new Date());
}
$('#form-consulta').addEventListener('submit', async e => {
  e.preventDefault();
  [selPac, inMed, inData].forEach(i => i.removeAttribute('aria-invalid'));
  inOrcamento.removeAttribute('aria-invalid');
  const pid = Number(selPac.value), medico = inMed.value.trim(), dataHora = inData.value;
  const valorOrcamento = inOrcamento.value.trim() === '' ? null : Number(inOrcamento.value);
  const orcamentoCentavos = valorOrcamento === null ? null : Math.round(valorOrcamento * 100);
  const falha = (msg, campo) => { setMsg(msgC, msg); campo.setAttribute('aria-invalid', 'true'); campo.focus(); };
  if (!pid) return falha('Selecione o paciente da consulta.', selPac);
  if (!medico) return falha('Erro: nome do médico é obrigatório.', inMed);
  if (!dataHora) return falha('Informe a data e a hora da consulta.', inData);
  if (new Date(dataHora) < new Date()) return falha('A data da consulta deve ser no futuro.', inData);
  if (valorOrcamento !== null && (!Number.isFinite(valorOrcamento) || valorOrcamento < 0
      || !Number.isSafeInteger(orcamentoCentavos)
      || Math.abs(valorOrcamento * 100 - orcamentoCentavos) > 1e-7)) {
    return falha('Informe um orçamento válido em reais, com até duas casas decimais.', inOrcamento);
  }
  const btn = $('#btn-agendar'); btn.disabled = true; btn.textContent = 'Agendando…'; setMsg(msgC, '');
  try {
    const c = await Api.agendarConsulta(pid, medico, dataHora, orcamentoCentavos);
    $('#form-consulta').reset(); await carregar();
    toast(`Consulta agendada: ${c.pacienteNome}, ${fmtHora.format(new Date(c.dataHora))}`);
  } catch (err) {
    setMsg(msgC, err instanceof ErroNegocio ? err.message : 'Não foi possível agendar. Tente novamente.');
  } finally { btn.disabled = false; btn.textContent = 'Agendar consulta'; }
});

const dlgOrcamento = $('#dlg-orcamento'), formOrcamento = $('#form-orcamento');
const inOrcamentoConsulta = $('#o-valor'), msgOrcamento = $('#msg-orcamento');
let consultaOrcamentoAtual = null;

function abrirOrcamento(c) {
  ultimoFoco = document.activeElement;
  consultaOrcamentoAtual = c;
  formOrcamento.reset();
  setMsg(msgOrcamento, '');
  inOrcamentoConsulta.removeAttribute('aria-invalid');
  $('#o-quem').textContent = `${c.pacienteNome} — com ${c.medico}`;
  inOrcamentoConsulta.value = c.orcamentoCentavos == null ? '' : (c.orcamentoCentavos / 100).toFixed(2);
  dlgOrcamento.showModal();
  inOrcamentoConsulta.focus();
}
dlgOrcamento.addEventListener('close', () => { ultimoFoco && ultimoFoco.focus && ultimoFoco.focus(); });
dlgOrcamento.addEventListener('click', e => { if (e.target === dlgOrcamento) dlgOrcamento.close(); });
$('#o-cancelar').addEventListener('click', () => dlgOrcamento.close());
$('#o-remover').addEventListener('click', async () => salvarOrcamento(null));

async function salvarOrcamento(centavos) {
  if (!consultaOrcamentoAtual) return;
  const consulta = consultaOrcamentoAtual;
  const salvar = $('#o-salvar'), remover = $('#o-remover');
  salvar.disabled = true;
  remover.disabled = true;
  setMsg(msgOrcamento, '');
  try {
    await Api.atualizarOrcamento(consulta.id, centavos);
    dlgOrcamento.close();
    consultaOrcamentoAtual = null;
    await carregar();
    toast(centavos == null ? 'Orçamento removido.' : `Orçamento salvo: ${fmtDinheiroCentavos(centavos)}`);
  } catch (err) {
    setMsg(msgOrcamento, err instanceof ErroNegocio ? err.message : 'Não foi possível salvar o orçamento.');
  } finally {
    salvar.disabled = false;
    remover.disabled = false;
  }
}

formOrcamento.addEventListener('submit', async e => {
  e.preventDefault();
  inOrcamentoConsulta.removeAttribute('aria-invalid');
  const valor = Number(inOrcamentoConsulta.value);
  const centavos = Math.round(valor * 100);
  if (inOrcamentoConsulta.value.trim() === '' || !Number.isFinite(valor) || valor < 0
      || !Number.isSafeInteger(centavos) || Math.abs(valor * 100 - centavos) > 1e-7) {
    setMsg(msgOrcamento, 'Informe um valor em reais, com até duas casas decimais.');
    inOrcamentoConsulta.setAttribute('aria-invalid', 'true');
    inOrcamentoConsulta.focus();
    return;
  }
  await salvarOrcamento(centavos);
});

const dlgR = $('#dlg-reagendar'), formR = $('#form-reagendar'), msgR = $('#msg-reagendar'), inRData = $('#r-data');
let consultaEditando = null;

function abrirReagendar(c) {
  ultimoFoco = document.activeElement; consultaEditando = c;
  formR.reset(); setMsg(msgR, ''); inRData.removeAttribute('aria-invalid');
  $('#reagendar-quem').textContent = `${c.pacienteNome} — com ${c.medico}`;
  inRData.min = isoLocal(new Date());
  inRData.value = c.dataHora.slice(0, 16);
  dlgR.showModal(); inRData.focus();
}
dlgR.addEventListener('close', () => { ultimoFoco && ultimoFoco.focus && ultimoFoco.focus(); });
dlgR.addEventListener('click', e => { if (e.target === dlgR) dlgR.close(); });
$('#r-cancelar').addEventListener('click', () => dlgR.close());

formR.addEventListener('submit', async e => {
  e.preventDefault();
  inRData.removeAttribute('aria-invalid');
  const novaData = inRData.value;
  if (!novaData) { setMsg(msgR, 'Informe a nova data e hora.'); inRData.setAttribute('aria-invalid', 'true'); inRData.focus(); return; }
  if (new Date(novaData) < new Date()) { setMsg(msgR, 'A nova data deve ser no futuro.'); inRData.setAttribute('aria-invalid', 'true'); inRData.focus(); return; }
  const salvar = $('#r-salvar'); salvar.disabled = true; salvar.textContent = 'Salvando…'; setMsg(msgR, '');
  try {
    await Api.reagendarConsulta(consultaEditando.id, novaData);
    dlgR.close(); await carregar(); toast(`Consulta reagendada: ${consultaEditando.pacienteNome}, ${fmtHora.format(new Date(novaData))}`);
  } catch (err) {
    setMsg(msgR, err instanceof ErroNegocio ? err.message : 'Não foi possível reagendar. Tente novamente.');
  } finally { salvar.disabled = false; salvar.textContent = 'Salvar novo horário'; }
});

/* =====================================================================
   11. LOGIN, SESSÃO E BLOQUEIO
   ===================================================================== */
const formLogin = $('#login-form'), inLogin = $('#login'), inSenha = $('#senha'), msgLogin = $('#login-msg'), btnLogin = $('#login-btn');
let falhas = 0, bloqueioTimer = null;

$('#pw-toggle').addEventListener('click', e => {
  const btn = e.currentTarget, mostrar = inSenha.type === 'password';
  inSenha.type = mostrar ? 'text' : 'password';
  btn.setAttribute('aria-pressed', String(mostrar));
  btn.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
  btn.replaceChildren(icon(mostrar ? 'eyeoff' : 'eye'));
});

function bloquear() {
  let resta = CONFIG.BLOQUEIO_S;
  btnLogin.disabled = true;
  const tick = () => {
    if (resta <= 0) { clearInterval(bloqueioTimer); btnLogin.disabled = false; falhas = 0; setMsg(msgLogin, ''); return; }
    setMsg(msgLogin, `Muitas tentativas. Tente de novo em ${resta} s.`); resta--;
  };
  clearInterval(bloqueioTimer); tick(); bloqueioTimer = setInterval(tick, 1000);
}

formLogin.addEventListener('submit', async e => {
  e.preventDefault();
  if (btnLogin.disabled) return;
  const login = inLogin.value.trim(), senha = inSenha.value.trim();
  inLogin.removeAttribute('aria-invalid'); inSenha.removeAttribute('aria-invalid');
  if (!login || !senha) {
    setMsg(msgLogin, 'Login e senha são obrigatórios.');
    (!login ? inLogin : inSenha).setAttribute('aria-invalid', 'true'); (!login ? inLogin : inSenha).focus();
    return;
  }
  setMsg(msgLogin, ''); btnLogin.disabled = true; btnLogin.textContent = 'Entrando…';
  let usuario = null, erroRede = false;
  try { usuario = await Api.autenticar(login, senha); } catch { erroRede = true; }
  inSenha.value = '';                                   // a senha nunca fica no campo depois do envio
  btnLogin.textContent = 'Entrar'; btnLogin.disabled = false;
  if (erroRede) { setMsg(msgLogin, 'Não foi possível conectar ao servidor. Tente novamente.'); return; }
  if (!usuario) {
    falhas++;
    if (falhas >= CONFIG.MAX_TENTATIVAS) bloquear();
    else setMsg(msgLogin, 'Login ou senha inválidos.');   // mensagem genérica: não revela qual dos dois errou
    inSenha.focus(); return;
  }
  falhas = 0; inLogin.value = '';
  entrar(usuario);
});

async function entrar(usuario) {
  sessao = { login: usuario.login };
  $('#login-view').hidden = true; $('#app-view').hidden = false;
  $('#user-login').textContent = sessao.login;
  $('#user-avatar').textContent = inicial(sessao.login);
  $('#demo-tag').hidden = CONFIG.MODO !== 'demo';
  await carregar();
  ir('inicio');
  armarInatividade();
}

function sair(aviso) {
  if (CONFIG.MODO === 'api' && sessao) Api.sair();   // não bloqueia a saída caso o servidor não responda
  clearTimeout(inatividade); sessao = null; pacientes = []; consultas = [];
  if ($('#dlg-paciente').open) $('#dlg-paciente').close();
  if ($('#dlg-reagendar').open) $('#dlg-reagendar').close();
  ['#proxima-corpo', '#resumo', '#inicio-agenda', '#pacientes-area', '#consultas-agenda'].forEach(s => $(s).replaceChildren());
  $('#form-consulta').reset(); $('#form-paciente').reset(); $('#form-reagendar').reset(); $('#busca').value = ''; resetarFoto();
  $('#app-view').hidden = true; $('#login-view').hidden = false;
  setMsg(msgLogin, aviso || '', 'info');
  inLogin.focus();
}
$('#btn-sair').addEventListener('click', () => sair('Você saiu com segurança.'));

let inatividade;
function armarInatividade() {
  clearTimeout(inatividade);
  if (!sessao) return;
  inatividade = setTimeout(() => sair('Sessão encerrada por inatividade. Entre novamente.'), CONFIG.INATIVIDADE_MS);
}
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => addEventListener(ev, armarInatividade, { passive: true, capture: true }));

// o servidor encerrou a sessão (expirou): volta para a tela de login
aoExpirarSessao = () => sair('Sessão expirada. Entre novamente.');

/* =====================================================================
   12. INICIALIZAÇÃO DA APLICAÇÃO
   ===================================================================== */
$('#demo-note').hidden = CONFIG.MODO !== 'demo';
inLogin.focus();
})();
