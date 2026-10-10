package service;

import java.util.List;
import java.util.regex.Pattern;
import model.Paciente;
import repository.PacienteRepository;

/** Regras de negócio de pacientes. Toda validação é feita aqui, independentemente do front-end. */
public class PacienteService {
    public static final int NOME_MAX = 100;
    public static final int CONVENIO_MAX = 60;
    public static final int FOTO_MAX_CARACTERES = 200_000;

    private static final Pattern FOTO_VALIDA =
            Pattern.compile("^data:image/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$");

    private final PacienteRepository repository;
    private int proximoId = 1;

    public PacienteService(PacienteRepository repository) {
        this.repository = repository;
    }

    public synchronized Paciente cadastrar(String nome, String cpf, String convenio) {
        return cadastrar(nome, cpf, convenio, null);
    }

    /** O CPF é armazenado somente com dígitos. Lança IllegalArgumentException se algum dado for inválido. */
    public synchronized Paciente cadastrar(String nome, String cpf, String convenio, String foto) {
        String[] dados = validarDados(nome, cpf, convenio, foto);
        if (repository.existePorCpf(dados[1])) {
            throw new IllegalArgumentException("CPF inválido: já existe um paciente com este CPF.");
        }

        Paciente paciente = new Paciente(proximoId++, dados[0], dados[1], dados[2], dados[3]);
        return repository.salvar(paciente);
    }

    public synchronized Paciente atualizar(int id, String nome, String cpf, String convenio, String foto) {
        String[] dados = validarDados(nome, cpf, convenio, foto);
        if (repository.existePorCpfExcetoId(dados[1], id)) {
            throw new IllegalArgumentException("CPF inválido: já existe um paciente com este CPF.");
        }
        return repository.atualizar(id, dados[0], dados[1], dados[2], dados[3]).orElse(null);
    }

    public synchronized List<Paciente> listarTodos() {
        return repository.listarTodos();
    }

    public synchronized Paciente buscarPorId(int id) {
        return repository.buscarPorId(id).orElse(null);
    }

    public synchronized boolean remover(int id) {
        return repository.remover(id);
    }

    // ------------------------------------------------------------ validações

    private static String[] validarDados(String nome, String cpf, String convenio, String foto) {
        nome = limpar(nome);
        convenio = limpar(convenio);
        String digitos = cpf == null ? "" : cpf.replaceAll("\\D", "");

        if (nome.isEmpty() || convenio.isEmpty() || cpf == null || cpf.isBlank()) {
            throw new IllegalArgumentException("Erro: todos os campos são obrigatórios.");
        }
        if (nome.length() > NOME_MAX) {
            throw new IllegalArgumentException("O nome deve ter no máximo " + NOME_MAX + " caracteres.");
        }
        if (convenio.length() > CONVENIO_MAX) {
            throw new IllegalArgumentException("O convênio deve ter no máximo " + CONVENIO_MAX + " caracteres.");
        }
        if (temCaractereDeControle(nome) || temCaractereDeControle(convenio)) {
            throw new IllegalArgumentException("Nome e convênio não podem conter caracteres de controle.");
        }
        if (!cpfValido(digitos)) {
            throw new IllegalArgumentException("CPF inválido: confira os 11 dígitos.");
        }
        return new String[] { nome, digitos, convenio, validarFoto(foto) };
    }

    private static String limpar(String valor) {
        return valor == null ? "" : valor.strip();
    }

    private static boolean temCaractereDeControle(String valor) {
        return valor.chars().anyMatch(Character::isISOControl);
    }

    /** Foto é opcional; quando enviada, deve ser uma imagem png/jpeg/webp em data URL e de tamanho limitado. */
    private static String validarFoto(String foto) {
        if (foto == null || foto.isBlank()) return null;
        if (foto.length() > FOTO_MAX_CARACTERES) {
            throw new IllegalArgumentException("A foto é grande demais.");
        }
        if (!FOTO_VALIDA.matcher(foto).matches()) {
            throw new IllegalArgumentException("Foto inválida. Envie uma imagem PNG, JPEG ou WebP.");
        }
        return foto;
    }

    /** 11 dígitos, não repetidos, com os dois dígitos verificadores corretos. */
    static boolean cpfValido(String digitos) {
        if (digitos.length() != 11 || digitos.matches("(\\d)\\1{10}")) return false;
        for (int t = 9; t < 11; t++) {
            int soma = 0;
            for (int i = 0; i < t; i++) {
                soma += (digitos.charAt(i) - '0') * (t + 1 - i);
            }
            if (((soma * 10) % 11) % 10 != digitos.charAt(t) - '0') return false;
        }
        return true;
    }
}
