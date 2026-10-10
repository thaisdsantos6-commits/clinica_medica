package model;

public class Paciente {
    private int id;
    private String nome;
    private String cpf;
    private String convenio;
    private String foto;      // data URL (png/jpeg/webp) opcional
    private String historico;

    public Paciente(int id, String nome, String cpf, String convenio) {
        this(id, nome, cpf, convenio, null);
    }

    public Paciente(int id, String nome, String cpf, String convenio, String foto) {
        this.id = id;
        this.nome = nome;
        this.cpf = cpf;
        this.convenio = convenio;
        this.foto = foto;
        this.historico = "";
    }

    public int getId() { return id; }
    public String getNome() { return nome; }
    public String getCpf() { return cpf; }
    public String getConvenio() { return convenio; }
    public String getFoto() { return foto; }
    public String getHistorico() { return historico; }

    public void atualizarDados(String nome, String cpf, String convenio, String foto) {
        this.nome = nome;
        this.cpf = cpf;
        this.convenio = convenio;
        this.foto = foto;
    }

    public void adicionarHistorico(String entrada) {
        this.historico = this.historico + entrada + "\n";
    }

    @Override
    public String toString() {
        return id + " - " + nome + " (" + convenio + ")";
    }
}
