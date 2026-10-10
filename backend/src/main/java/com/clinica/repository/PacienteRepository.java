package repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import model.Paciente;

/**
 * Armazenamento de pacientes em memória (os dados são perdidos ao reiniciar o servidor).
 * Não é thread-safe por si só: o acesso é serializado pelo PacienteService.
 */
public class PacienteRepository {
    private final List<Paciente> pacientes = new ArrayList<>();

    public Paciente salvar(Paciente paciente) {
        pacientes.add(paciente);
        return paciente;
    }

    public List<Paciente> listarTodos() {
        return new ArrayList<>(pacientes);
    }

    public Optional<Paciente> buscarPorId(int id) {
        return pacientes.stream()
                .filter(paciente -> paciente.getId() == id)
                .findFirst();
    }

    public boolean existePorCpf(String cpf) {
        return pacientes.stream().anyMatch(paciente -> paciente.getCpf().equals(cpf));
    }

    public boolean existePorCpfExcetoId(String cpf, int id) {
        return pacientes.stream().anyMatch(paciente -> paciente.getId() != id && paciente.getCpf().equals(cpf));
    }

    public Optional<Paciente> atualizar(int id, String nome, String cpf, String convenio, String foto) {
        Optional<Paciente> encontrado = buscarPorId(id);
        encontrado.ifPresent(paciente -> paciente.atualizarDados(nome, cpf, convenio, foto));
        return encontrado;
    }

    public boolean remover(int id) {
        return pacientes.removeIf(paciente -> paciente.getId() == id);
    }
}
