package service;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import model.Usuario;
import util.Seguranca;

/** Autenticação de usuários e controle de sessões (em memória). */
public class AutenticacaoService {
    // ====================================================================
    //  CREDENCIAL DE DEMONSTRAÇÃO (DEMO) — NÃO USE EM PRODUÇÃO.
    //  É usada apenas quando as variáveis de ambiente abaixo não estão definidas:
    //    CLINICA_ADMIN_LOGIN  e  CLINICA_ADMIN_SENHA
    // ====================================================================
    private static final String DEMO_LOGIN = "admin";
    private static final String DEMO_SENHA = "123456";

    public static final int LOGIN_MAX = 40;
    public static final int SENHA_MAX = 72;
    public static final long INATIVIDADE_MS = 10 * 60 * 1000L;

    private final Map<String, Usuario> usuarios = new ConcurrentHashMap<>();
    private final Map<String, Sessao> sessoes = new HashMap<>();
    // hash descartável: mantém o tempo de resposta parecido quando o login não existe
    private final String hashFalso = Seguranca.gerarHash("senha-inexistente");

    private static final class Sessao {
        final String login;
        long ultimoUso;

        Sessao(String login, long ultimoUso) {
            this.login = login;
            this.ultimoUso = ultimoUso;
        }
    }

    public AutenticacaoService() {
        String login = System.getenv("CLINICA_ADMIN_LOGIN");
        String senha = System.getenv("CLINICA_ADMIN_SENHA");
        if (login == null || login.isBlank() || senha == null || senha.isBlank()) {
            login = DEMO_LOGIN;
            senha = DEMO_SENHA;
            System.out.println("AVISO: usando a credencial de DEMONSTRAÇÃO (" + DEMO_LOGIN + "). "
                    + "Defina CLINICA_ADMIN_LOGIN e CLINICA_ADMIN_SENHA para usar outra.");
        }
        cadastrarUsuario(login, senha, "ADMIN");
    }

    public final void cadastrarUsuario(String login, String senha, String papel) {
        usuarios.put(login, new Usuario(login, Seguranca.gerarHash(senha), papel));
    }

    /**
     * Retorna o usuário se as credenciais forem válidas e null se forem inválidas.
     * Lança IllegalArgumentException se login/senha estiverem vazios ou grandes demais.
     */
    public Usuario autenticar(String login, String senha) {
        if (login == null || login.isBlank() || senha == null || senha.isBlank()) {
            throw new IllegalArgumentException("Login e senha são obrigatórios.");
        }
        if (login.length() > LOGIN_MAX || senha.length() > SENHA_MAX) {
            throw new IllegalArgumentException("Login ou senha excedem o tamanho máximo permitido.");
        }

        Usuario usuario = usuarios.get(login);
        boolean senhaConfere = Seguranca.verificar(senha, usuario != null ? usuario.getSenhaHash() : hashFalso);
        return (usuario != null && senhaConfere) ? usuario : null;
    }

    // ---------------------------------------------------------------- sessões

    /** Cria uma sessão para o usuário e devolve o token (enviado ao navegador em cookie HttpOnly). */
    public synchronized String iniciarSessao(Usuario usuario) {
        long agora = System.currentTimeMillis();
        sessoes.values().removeIf(s -> agora - s.ultimoUso > INATIVIDADE_MS);
        String token = Seguranca.gerarToken();
        sessoes.put(token, new Sessao(usuario.getLogin(), agora));
        return token;
    }

    /** Retorna o usuário da sessão (renovando o prazo de inatividade) ou null se inexistente/expirada. */
    public synchronized Usuario validarSessao(String token) {
        if (token == null) return null;
        Sessao sessao = sessoes.get(token);
        if (sessao == null) return null;

        long agora = System.currentTimeMillis();
        if (agora - sessao.ultimoUso > INATIVIDADE_MS) {
            sessoes.remove(token);
            return null;
        }
        sessao.ultimoUso = agora;
        return usuarios.get(sessao.login);
    }

    public synchronized void encerrarSessao(String token) {
        if (token != null) sessoes.remove(token);
    }
}
