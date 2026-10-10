package service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import model.Consulta;
import model.Paciente;

/** Regras de negócio da agenda de consultas. Toda validação é feita aqui, independentemente do front-end. */
public class AgendaService {
    public static final int MEDICO_MAX = 80;

    private final List<Consulta> consultas = new ArrayList<>();
    private int proximoId = 1;

    public synchronized Consulta agendar(Paciente paciente, String medico, LocalDateTime dataHora) {
        return agendar(paciente, medico, dataHora, null);
    }

    public synchronized Consulta agendar(Paciente paciente, String medico, LocalDateTime dataHora, Long orcamentoCentavos) {
        if (paciente == null) throw new IllegalArgumentException("Paciente inválido.");
        medico = validarMedico(medico);
        dataHora = validarDataFutura(dataHora, "A data da consulta deve ser no futuro.");
        validarHorarioLivre(medico, dataHora, -1);
        validarOrcamento(orcamentoCentavos);

        Consulta consulta = new Consulta(proximoId++, paciente, medico, dataHora);
        consulta.setOrcamentoCentavos(orcamentoCentavos);
        consultas.add(consulta);
        return consulta;
    }

    /** Muda a data/hora de uma consulta. Retorna null se a consulta não existir. */
    public synchronized Consulta reagendar(int id, LocalDateTime novaDataHora) {
        Consulta consulta = buscarPorId(id);
        if (consulta == null) return null;

        novaDataHora = validarDataFutura(novaDataHora, "A nova data deve ser no futuro.");
        validarHorarioLivre(consulta.getMedico(), novaDataHora, id);
        consulta.setDataHora(novaDataHora);
        return consulta;
    }

    /** Atualiza ou remove o orçamento de uma consulta. Retorna null se a consulta não existir. */
    public synchronized Consulta atualizarOrcamento(int id, Long orcamentoCentavos) {
        Consulta consulta = buscarPorId(id);
        if (consulta == null) return null;
        validarOrcamento(orcamentoCentavos);
        consulta.setOrcamentoCentavos(orcamentoCentavos);
        return consulta;
    }

    public synchronized Consulta buscarPorId(int id) {
        for (Consulta consulta : consultas) {
            if (consulta.getId() == id) return consulta;
        }
        return null;
    }

    public synchronized List<Consulta> listarPorMedico(String medico) {
        List<Consulta> resultado = new ArrayList<>();
        for (Consulta consulta : consultas) {
            if ("AGENDADA".equals(consulta.getStatus())
                    && consulta.getMedico().equalsIgnoreCase(medico)) {
                resultado.add(consulta);
            }
        }
        return resultado;
    }

    public synchronized List<Consulta> listarTodas() {
        return new ArrayList<>(consultas);
    }

    /** Remove as consultas de um paciente (usado quando o paciente é excluído). */
    public synchronized int removerPorPaciente(int pacienteId) {
        int antes = consultas.size();
        consultas.removeIf(consulta -> consulta.getPaciente().getId() == pacienteId);
        return antes - consultas.size();
    }

    // ------------------------------------------------------------ validações

    private static void validarOrcamento(Long orcamentoCentavos) {
        if (orcamentoCentavos != null && orcamentoCentavos < 0) {
            throw new IllegalArgumentException("O orçamento deve ser igual ou maior que zero.");
        }
    }

    private static String validarMedico(String medico) {
        medico = medico == null ? "" : medico.strip();
        if (medico.isEmpty()) throw new IllegalArgumentException("Nome do médico é obrigatório.");
        if (medico.length() > MEDICO_MAX) {
            throw new IllegalArgumentException("O nome do médico deve ter no máximo " + MEDICO_MAX + " caracteres.");
        }
        if (medico.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("O nome do médico não pode conter caracteres de controle.");
        }
        return medico;
    }

    /** Exige data/hora informada e no futuro. Trunca para minutos (a agenda trabalha em minutos). */
    private static LocalDateTime validarDataFutura(LocalDateTime dataHora, String mensagem) {
        if (dataHora == null) throw new IllegalArgumentException("Informe a data e a hora da consulta.");
        if (dataHora.isBefore(LocalDateTime.now())) throw new IllegalArgumentException(mensagem);
        return dataHora.truncatedTo(ChronoUnit.MINUTES);
    }

    /** Um médico não pode ter duas consultas no mesmo horário (ignora a consulta "ignorarId"). */
    private void validarHorarioLivre(String medico, LocalDateTime dataHora, int ignorarId) {
        for (Consulta existente : consultas) {
            if (existente.getId() != ignorarId
                    && existente.getMedico().equalsIgnoreCase(medico)
                    && existente.getDataHora().equals(dataHora)) {
                throw new IllegalArgumentException("Este médico já tem uma consulta neste horário.");
            }
        }
    }
}
