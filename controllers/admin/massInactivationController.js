const { Op } = require('sequelize');
const Sleeping = require('../../schema/tb_sleeping');
const Clientes = require('../../schema/tb_clientes');
const actions = require('../telemedicinaActions/actions');
const dormir = require('../../functions/crud');

// Estado em memória do job de inativação
let currentJob = {
    status: 'idle', // 'idle' | 'running' | 'completed' | 'stopped' | 'error'
    total: 0,
    processed: 0,
    success: 0,
    skipped: 0,
    errors: 0,
    currentCpf: null,
    startedAt: null,
    finishedAt: null,
    shouldStop: false,
    logs: []
};

function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    currentJob.logs.push({
        id: Date.now() + Math.random(),
        time: timestamp,
        type,
        message
    });

    if (currentJob.logs.length > 300) {
        currentJob.logs.shift();
    }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runMassInactivationTask(exclusions = [], delayMs = 3000, targetLimit = null) {
    try {
        addLog('Buscando beneficiários na Rapidoc via listarBeneficiarios()...', 'info');
        const rawBeneficiaries = await actions.listarBeneficiarios();

        const list = Array.isArray(rawBeneficiaries)
            ? rawBeneficiaries
            : (rawBeneficiaries?.beneficiaries || rawBeneficiaries?.data || []);

        if (!list || list.length === 0) {
            currentJob.status = 'error';
            currentJob.finishedAt = new Date();
            addLog('Nenhum beneficiário retornado pela Rapidoc.', 'error');
            return;
        }

        addLog(`Total recebido da Rapidoc: ${list.length} beneficiários.`, 'info');

        // Filtrar serviceTypes proibidos de inativação: P, GP, GSP
        const elegiveis = list.filter(item => item.cpf && !['P', 'GP', 'GSP'].includes(item.serviceType));
        addLog(`Beneficiários elegíveis (fora de P, GP, GSP): ${elegiveis.length}.`, 'info');

        // Normalizar exclusões em Set (somente números)
        const normalizedExclusions = new Set(
            exclusions.map(cpf => String(cpf).replace(/\D/g, '')).filter(Boolean)
        );
        addLog(`Lista de exclusões (CSV/manual): ${normalizedExclusions.size} CPFs bloqueados.`, 'info');

        // Filtrar candidatos
        const candidatos = elegiveis.filter(item => {
            const digits = String(item.cpf).replace(/\D/g, '');
            return digits && !normalizedExclusions.has(digits);
        });

        if (targetLimit && targetLimit > 0) {
            addLog(`Meta de inativações definida pelo administrador: ${targetLimit} vidas.`, 'info');
        }

        currentJob.targetLimit = targetLimit && targetLimit > 0 ? targetLimit : null;
        currentJob.total = currentJob.targetLimit ? Math.min(candidatos.length, currentJob.targetLimit) : candidatos.length;
        currentJob.processed = 0;
        currentJob.success = 0;
        currentJob.skipped = 0;
        currentJob.errors = 0;

        addLog(`Total a processar após exclusões: ${currentJob.total} CPFs (de ${candidatos.length} disponíveis).`, 'info');

        for (const item of candidatos) {
            if (currentJob.targetLimit && currentJob.success >= currentJob.targetLimit) {
                addLog(`🎯 Meta de ${currentJob.targetLimit} inativações concluída com sucesso! Fila finalizada.`, 'success');
                break;
            }

            if (currentJob.shouldStop) {
                currentJob.status = 'stopped';
                currentJob.finishedAt = new Date();
                addLog('Processo interrompido pelo usuário.', 'warning');
                return;
            }

            const cpfClean = String(item.cpf).replace(/\D/g, '');
            currentJob.currentCpf = cpfClean;

            // Verificar se já existe na tabela Sleeping
            const alreadySleeping = await Sleeping.findOne({
                where: {
                    [Op.or]: [
                        { idVida: item.cpf },
                        { idVida: cpfClean }
                    ]
                },
                attributes: ['id']
            }).catch(() => null);

            if (alreadySleeping) {
                currentJob.skipped++;
                currentJob.processed++;
                addLog(`[IGNORADO] CPF ${cpfClean} já consta na tabela sleeping.`, 'warning');
                continue; // Não aplica delay desnecessário para ignorados
            }

            // Executar inativação na Rapidoc
            try {
                addLog(`[PROCESSANDO] Inativando CPF ${cpfClean} (${item.name || 'Sem nome'})...`, 'info');
                const resultado = await dormir.delete(cpfClean);

                if (!resultado) {
                    throw new Error('Retorno vazio da API de inativação.');
                }

                const beneficiaryUuid = resultado.beneficiary?.uuid || item.uuid || null;

                // Registrar na tabela Sleeping
                await Sleeping.create({
                    idVida: cpfClean,
                    uuid: beneficiaryUuid
                });

                // Atualizar uuid em tb_clientes (sem alterar situacao, conforme regra)
                if (beneficiaryUuid) {
                    await Clientes.update({
                        uuid: beneficiaryUuid
                    }, {
                        where: {
                            [Op.or]: [
                                { nu_documento: cpfClean },
                                { nu_documento: item.cpf }
                            ]
                        }
                    }).catch(e => console.error("Erro ao atualizar uuid no cliente:", e.message));
                }

                currentJob.success++;
                currentJob.processed++;
                addLog(`[SUCESSO] CPF ${cpfClean} inativado com sucesso!`, 'success');

                // Aguarda o intervalo de rate limit antes do próximo
                await delay(delayMs);
            } catch (err) {
                currentJob.errors++;
                currentJob.processed++;
                const errMsg = err.response?.data?.message || err.message || 'Erro desconhecido';
                addLog(`[ERRO] Falha ao inativar ${cpfClean}: ${errMsg}`, 'error');
                await delay(1500);
            }
        }

        currentJob.status = 'completed';
        currentJob.finishedAt = new Date();
        currentJob.currentCpf = null;
        addLog(`🏁 Processo concluído! Sucessos: ${currentJob.success}, Ignorados: ${currentJob.skipped}, Erros: ${currentJob.errors}`, 'success');
    } catch (criticalErr) {
        currentJob.status = 'error';
        currentJob.finishedAt = new Date();
        addLog(`Erro crítico no processamento: ${criticalErr.message}`, 'error');
        console.error('Erro crítico em runMassInactivationTask:', criticalErr);
    }
}

module.exports = {
    preview: async (req, res) => {
        try {
            const rawExclusions = Array.isArray(req.body.exclusions) ? req.body.exclusions : [];
            const normalizedExclusions = new Set(
                rawExclusions.map(cpf => String(cpf).replace(/\D/g, '')).filter(Boolean)
            );

            const rawBeneficiaries = await actions.listarBeneficiarios();
            const list = Array.isArray(rawBeneficiaries)
                ? rawBeneficiaries
                : (rawBeneficiaries?.beneficiaries || rawBeneficiaries?.data || []);

            const elegiveis = list.filter(item => item.cpf && !['P', 'GP', 'GSP'].includes(item.serviceType));
            
            let excludedCount = 0;
            const elegiveisParaVerificar = [];

            for (const item of elegiveis) {
                const digits = String(item.cpf).replace(/\D/g, '');
                if (normalizedExclusions.has(digits)) {
                    excludedCount++;
                } else {
                    elegiveisParaVerificar.push(digits);
                }
            }

            // Consultar quantos dos elegíveis já constam na tabela sleeping
            let alreadySleepingCount = 0;
            if (elegiveisParaVerificar.length > 0) {
                const sleepings = await Sleeping.findAll({
                    where: {
                        idVida: { [Op.in]: elegiveisParaVerificar }
                    },
                    attributes: ['idVida'],
                    raw: true
                }).catch(() => []);
                alreadySleepingCount = sleepings.length;
            }

            const estimatedToProcess = Math.max(0, elegiveisParaVerificar.length - alreadySleepingCount);

            return res.json({
                success: true,
                totalRapidoc: list.length,
                totalElegiveis: elegiveis.length,
                totalExclusoes: excludedCount,
                totalJaSleeping: alreadySleepingCount,
                totalEstimadoProcessar: estimatedToProcess
            });
        } catch (error) {
            console.error('Erro no preview de inativação:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Erro ao simular inativação.'
            });
        }
    },

    start: async (req, res) => {
        if (currentJob.status === 'running') {
            return res.status(400).json({
                success: false,
                message: 'Já existe um processo de inativação em andamento.',
                job: {
                    status: currentJob.status,
                    total: currentJob.total,
                    processed: currentJob.processed
                }
            });
        }

        const rawExclusions = Array.isArray(req.body.exclusions) ? req.body.exclusions : [];
        const delayMs = parseInt(req.body.delayMs, 10) || 3500;
        const targetLimit = req.body.limit && parseInt(req.body.limit, 10) > 0 ? parseInt(req.body.limit, 10) : null;

        currentJob = {
            status: 'running',
            total: 0,
            processed: 0,
            success: 0,
            skipped: 0,
            errors: 0,
            targetLimit,
            currentCpf: null,
            startedAt: new Date(),
            finishedAt: null,
            shouldStop: false,
            logs: []
        };

        addLog(`Iniciando job de inativação com delay de ${delayMs}ms${targetLimit ? ` (limite de ${targetLimit} vidas)` : ''}...`, 'info');

        // Dispara execução em segundo plano sem travar a requisição
        runMassInactivationTask(rawExclusions, delayMs, targetLimit);

        return res.json({
            success: true,
            message: 'Processamento em segundo plano iniciado com sucesso.',
            job: {
                status: currentJob.status,
                startedAt: currentJob.startedAt
            }
        });
    },

    status: async (req, res) => {
        return res.json({
            success: true,
            job: {
                status: currentJob.status,
                total: currentJob.total,
                processed: currentJob.processed,
                success: currentJob.success,
                skipped: currentJob.skipped,
                errors: currentJob.errors,
                currentCpf: currentJob.currentCpf,
                startedAt: currentJob.startedAt,
                finishedAt: currentJob.finishedAt,
                logs: currentJob.logs.slice(-100)
            }
        });
    },

    stop: async (req, res) => {
        if (currentJob.status !== 'running') {
            return res.json({
                success: true,
                message: 'Nenhum processo em execução para interromper.'
            });
        }

        currentJob.shouldStop = true;
        addLog('Sinal de interrupção recebido. O processo será finalizado após a vida atual...', 'warning');

        return res.json({
            success: true,
            message: 'Solicitação de parada enviada com sucesso.'
        });
    }
};
