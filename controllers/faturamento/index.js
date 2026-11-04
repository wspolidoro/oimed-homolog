const { sequelize } = require('../../db');
const Franqueado = require('../../schema/tb_franqueado');
const Clientes = require('../../schema/tb_clientes');
const Planos = require('../../schema/tb_planos');
const Faturamentos = require('../../schema/tb_faturamentos');
const { Op } = require('sequelize');

// Tabela de Preços Padrão do Sistema (utilizada como fallback inteligente quando o parceiro não possui oi_planos cadastrado)
const PRECOS_PADRAO = {
    individual: {
        g: 3.90,
        p: 24.90,
        gp: 26.90,
        gs: 5.90,
        gsp: 30.80
    },
    familiar: {
        g: 12.90,
        p: 24.90,
        gp: 34.90,
        gs: 16.90,
        gsp: 41.80
    },
    manutencao_mensal: 197.00
};

/**
 * Normaliza e busca o preço do plano, garantindo fallback sem quebrar a execução
 */
function resolverPreco(planosList, cobertura, tipo, fallbackPrecoFranqueado = null) {
    const cob = String(cobertura).toLowerCase();
    const tip = String(tipo).toLowerCase();

    const encontrado = planosList.find(item => 
        String(item.plano).toLowerCase() === cob && 
        String(item.tipo).toLowerCase() === tip
    );

    if (encontrado && encontrado.valor != null && !isNaN(Number(encontrado.valor))) {
        return Number(encontrado.valor);
    }

    if (fallbackPrecoFranqueado != null && !isNaN(Number(fallbackPrecoFranqueado))) {
        return Number(fallbackPrecoFranqueado);
    }

    return PRECOS_PADRAO[cob]?.[tip] ?? 0;
}

/**
 * Normaliza e busca o valor de manutenção mensal
 */
function resolverManutencao(planosList) {
    const itemManutencao = planosList.find(item => 
        item.manutencao_mensal != null && !isNaN(Number(item.manutencao_mensal)) && Number(item.manutencao_mensal) > 0
    );

    if (itemManutencao) {
        return Number(itemManutencao.manutencao_mensal);
    }

    return PRECOS_PADRAO.manutencao_mensal;
}

module.exports = {
    /**
     * Lista parceiros disponíveis para faturamento.
     * Administradores Master veem todos; Parceiros veem apenas o seu próprio cadastro.
     */
    listParceiros: async (req, res) => {
        try {
            const user = req.user || {};
            const isMaster = user.autoridade === 1 || user.perfil === 'master';

            const where = {};
            if (!isMaster && user.id) {
                where.id = user.id;
            }

            const parceiros = await Franqueado.findAll({
                where,
                order: [['nome', 'ASC']],
                attributes: ['id', 'nome', 'cpf', 'status', 'precoIndividual', 'precoFamiliar', 'perfil']
            });

            return res.json(parceiros);
        } catch (err) {
            console.error("Erro ao listar parceiros para faturamento:", err);
            return res.status(500).json({ error: "Erro interno ao listar parceiros." });
        }
    },

    /**
     * Calcula o faturamento detalhado de um parceiro em tempo real (com base nos clientes ativos/inativos)
     * e cruza com faturas já fechadas na tabela oi_faturamentos.
     */
    listDados: async (req, res) => {
        try {
            const partnerId = req.params.id || req.query.id;
            const user = req.user || {};
            const isMaster = user.autoridade === 1 || user.perfil === 'master';

            // Segurança: parceiro comum só pode consultar o seu próprio ID
            if (!isMaster && user.id && String(user.id) !== String(partnerId)) {
                return res.status(403).json({ success: false, message: "Acesso restrito ao seu próprio faturamento." });
            }

            const parceiro = await Franqueado.findByPk(partnerId, {
                attributes: ['id', 'nome', 'cpf', 'email', 'telefone', 'status', 'precoIndividual', 'precoFamiliar'],
                raw: true
            });

            if (!parceiro) {
                return res.status(404).json({ success: false, message: "Parceiro não encontrado." });
            }

            // Definição do período de referência (Mês e Ano)
            const hoje = new Date();
            const mesParam = parseInt(req.query.mes, 10);
            const anoParam = parseInt(req.query.ano, 10);

            const mesReferenciaNum = (!isNaN(mesParam) && mesParam >= 1 && mesParam <= 12) ? mesParam : hoje.getMonth() + 1;
            const anoReferenciaNum = (!isNaN(anoParam) && anoParam >= 2020) ? anoParam : hoje.getFullYear();
            const mesFormatado = String(mesReferenciaNum).padStart(2, '0');
            const chaveMesAno = `${anoReferenciaNum}-${mesFormatado}`;

            // Período para contagem de inativações (mês anterior ao fechamento ou mês de referência)
            const inicioPeriodo = new Date(anoReferenciaNum, mesReferenciaNum - 1, 1);
            const fimPeriodo = new Date(anoReferenciaNum, mesReferenciaNum, 0, 23, 59, 59);

            // 1. Busca Clientes Individuais
            const listClientesIndividual = await Clientes.findAll({
                where: {
                    id_franqueado: partnerId,
                    cobertura: 'individual'
                },
                attributes: ['id', 'nm_cliente', 'serviceType', 'dtDesativacao', 'dtAtivacao', 'cobertura', 'situacao'],
                raw: true
            });

            // 2. Busca Clientes Familiares (apenas os titulares para fins de contagem do plano familiar)
            const listClientesFamiliar = await Clientes.findAll({
                where: {
                    id_franqueado: partnerId,
                    cobertura: 'familiar',
                    [Op.or]: [
                        { cpf_titular: 'titular' },
                        { cpf_titular: null },
                        { cpf_titular: '' }
                    ]
                },
                attributes: ['id', 'nm_cliente', 'serviceType', 'dtDesativacao', 'dtAtivacao', 'cobertura', 'situacao'],
                raw: true
            });

            // 3. Contagem por tipo de serviço (Individual)
            const countIndividual = {
                G: listClientesIndividual.filter(c => c.situacao === 'ativo' && String(c.serviceType).toUpperCase() === 'G').length,
                P: listClientesIndividual.filter(c => c.situacao === 'ativo' && String(c.serviceType).toUpperCase() === 'P').length,
                GP: listClientesIndividual.filter(c => c.situacao === 'ativo' && String(c.serviceType).toUpperCase() === 'GP').length,
                GS: listClientesIndividual.filter(c => c.situacao === 'ativo' && String(c.serviceType).toUpperCase() === 'GS').length,
                GSP: listClientesIndividual.filter(c => c.situacao === 'ativo' && String(c.serviceType).toUpperCase() === 'GSP').length,
            };
            const totalAtivosIndividual = Object.values(countIndividual).reduce((acc, v) => acc + v, 0);

            // Inativos no período (Individual)
            const inativosIndividual = listClientesIndividual.filter(c => {
                if (c.situacao !== 'inativo') return false;
                if (!c.dtDesativacao) return false;
                const d = new Date(c.dtDesativacao);
                return d >= inicioPeriodo && d <= fimPeriodo;
            }).length;

            // 4. Contagem por tipo de serviço (Familiar)
            const countFamiliar = {
                G: listClientesFamiliar.filter(c => c.situacao === 'ativo' && String(c.serviceType).toUpperCase() === 'G').length,
                P: listClientesFamiliar.filter(c => c.situacao === 'ativo' && String(c.serviceType).toUpperCase() === 'P').length,
                GP: listClientesFamiliar.filter(c => c.situacao === 'ativo' && String(c.serviceType).toUpperCase() === 'GP').length,
                GS: listClientesFamiliar.filter(c => c.situacao === 'ativo' && String(c.serviceType).toUpperCase() === 'GS').length,
                GSP: listClientesFamiliar.filter(c => c.situacao === 'ativo' && String(c.serviceType).toUpperCase() === 'GSP').length,
            };
            const totalAtivosFamiliar = Object.values(countFamiliar).reduce((acc, v) => acc + v, 0);

            // Inativos no período (Familiar)
            const inativosFamiliar = listClientesFamiliar.filter(c => {
                if (c.situacao !== 'inativo') return false;
                if (!c.dtDesativacao) return false;
                const d = new Date(c.dtDesativacao);
                return d >= inicioPeriodo && d <= fimPeriodo;
            }).length;

            // 5. Preços configurados na tabela oi_planos
            const planosList = await Planos.findAll({
                where: { id_franqueado: partnerId },
                raw: true
            });

            // Tabela com os preços unitários calculados
            const precosUnitarios = {
                individual: {
                    G: resolverPreco(planosList, 'individual', 'g', parceiro.precoIndividual),
                    P: resolverPreco(planosList, 'individual', 'p', parceiro.precoIndividual),
                    GP: resolverPreco(planosList, 'individual', 'gp', parceiro.precoIndividual),
                    GS: resolverPreco(planosList, 'individual', 'gs', parceiro.precoIndividual),
                    GSP: resolverPreco(planosList, 'individual', 'gsp', parceiro.precoIndividual),
                },
                familiar: {
                    G: resolverPreco(planosList, 'familiar', 'g', parceiro.precoFamiliar),
                    P: resolverPreco(planosList, 'familiar', 'p', parceiro.precoFamiliar),
                    GP: resolverPreco(planosList, 'familiar', 'gp', parceiro.precoFamiliar),
                    GS: resolverPreco(planosList, 'familiar', 'gs', parceiro.precoFamiliar),
                    GSP: resolverPreco(planosList, 'familiar', 'gsp', parceiro.precoFamiliar),
                },
                manutencao_mensal: resolverManutencao(planosList)
            };

            // Cálculo dos Subtotais
            const subtotalIndividualG = countIndividual.G * precosUnitarios.individual.G;
            const subtotalIndividualP = countIndividual.P * precosUnitarios.individual.P;
            const subtotalIndividualGP = countIndividual.GP * precosUnitarios.individual.GP;
            const subtotalIndividualGS = countIndividual.GS * precosUnitarios.individual.GS;
            const subtotalIndividualGSP = countIndividual.GSP * precosUnitarios.individual.GSP;
            const totalIndividual = subtotalIndividualG + subtotalIndividualP + subtotalIndividualGP + subtotalIndividualGS + subtotalIndividualGSP;

            const subtotalFamiliarG = countFamiliar.G * precosUnitarios.familiar.G;
            const subtotalFamiliarP = countFamiliar.P * precosUnitarios.familiar.P;
            const subtotalFamiliarGP = countFamiliar.GP * precosUnitarios.familiar.GP;
            const subtotalFamiliarGS = countFamiliar.GS * precosUnitarios.familiar.GS;
            const subtotalFamiliarGSP = countFamiliar.GSP * precosUnitarios.familiar.GSP;
            const totalFamiliar = subtotalFamiliarG + subtotalFamiliarP + subtotalFamiliarGP + subtotalFamiliarGS + subtotalFamiliarGSP;

            const totalManutencao = precosUnitarios.manutencao_mensal;
            const valorTotalConsolidado = totalIndividual + totalFamiliar + totalManutencao;

            // 6. Verifica se já existe fatura fechada/salva para este parceiro e período na tabela oi_faturamentos
            const faturaSalva = await Faturamentos.findOne({
                where: {
                    id_franqueado: partnerId,
                    [Op.or]: [
                        { mes_referencia: chaveMesAno },
                        { mes_referencia: `${mesFormatado}/${anoReferenciaNum}` }
                    ]
                },
                raw: true
            });

            return res.json({
                success: true,
                parceiro: {
                    id: parceiro.id,
                    nome: parceiro.nome,
                    cpf: parceiro.cpf,
                    email: parceiro.email
                },
                mesReferencia: mesFormatado,
                anoReferencia: anoReferenciaNum,
                chaveMesAno: chaveMesAno,
                individualPlan: {
                    qtdaPlans: countIndividual,
                    subtotais: {
                        G: subtotalIndividualG,
                        P: subtotalIndividualP,
                        GP: subtotalIndividualGP,
                        GS: subtotalIndividualGS,
                        GSP: subtotalIndividualGSP
                    },
                    totalRegister: totalAtivosIndividual,
                    totalInativates: inativosIndividual,
                    valorTotal: totalIndividual
                },
                familiarPlan: {
                    qtdaPlans: countFamiliar,
                    subtotais: {
                        G: subtotalFamiliarG,
                        P: subtotalFamiliarP,
                        GP: subtotalFamiliarGP,
                        GS: subtotalFamiliarGS,
                        GSP: subtotalFamiliarGSP
                    },
                    totalRegister: totalAtivosFamiliar,
                    totalInativates: inativosFamiliar,
                    valorTotal: totalFamiliar
                },
                precosUnitarios: precosUnitarios,
                precoTotalIndividual: totalIndividual,
                precoTotalFamiliar: totalFamiliar,
                valorManutencao: totalManutencao,
                precoTotal: valorTotalConsolidado,
                totalVidas: totalAtivosIndividual + totalAtivosFamiliar,
                faturaSalva: faturaSalva || null
            });

        } catch (err) {
            console.error("Erro ao calcular faturamento:", err);
            return res.status(500).json({
                success: false,
                message: "Erro ao calcular os valores de faturamento."
            });
        }
    },

    /**
     * Retorna o histórico de faturas fechadas de um parceiro
     */
    getHistorico: async (req, res) => {
        try {
            const partnerId = req.params.id;
            const user = req.user || {};
            const isMaster = user.autoridade === 1 || user.perfil === 'master';

            if (!isMaster && user.id && String(user.id) !== String(partnerId)) {
                return res.status(403).json({ success: false, message: "Acesso restrito ao seu próprio histórico." });
            }

            const historico = await Faturamentos.findAll({
                where: { id_franqueado: partnerId },
                order: [['id', 'DESC']]
            });

            return res.json(historico);
        } catch (err) {
            console.error("Erro ao buscar histórico de faturas:", err);
            return res.status(500).json({ error: "Erro interno ao buscar histórico." });
        }
    },

    /**
     * Fecha e registra oficialmente a fatura mensal na tabela oi_faturamentos
     */
    fecharFatura: async (req, res) => {
        try {
            const user = req.user || {};
            const isMaster = user.autoridade === 1 || user.perfil === 'master';

            const {
                id_franqueado,
                mes_referencia,
                ano_referencia,
                total_vidas_individual,
                total_vidas_familiar,
                total_vidas,
                total_inativos_individual,
                total_inativos_familiar,
                detalhes_planos,
                valor_individual,
                valor_familiar,
                valor_manutencao,
                valor_total,
                data_vencimento,
                observacoes
            } = req.body;

            if (!id_franqueado || !mes_referencia || !ano_referencia) {
                return res.status(400).json({ success: false, message: "Parceiro, mês e ano de referência são obrigatórios." });
            }

            if (!isMaster && user.id && String(user.id) !== String(id_franqueado)) {
                return res.status(403).json({ success: false, message: "Não autorizado a fechar faturas para este parceiro." });
            }

            // Upsert: atualiza se já existir fatura para o mesmo parceiro e mês
            const [fatura, created] = await Faturamentos.findOrCreate({
                where: {
                    id_franqueado: id_franqueado,
                    mes_referencia: String(mes_referencia),
                    ano_referencia: Number(ano_referencia)
                },
                defaults: {
                    total_vidas_individual: total_vidas_individual || 0,
                    total_vidas_familiar: total_vidas_familiar || 0,
                    total_vidas: total_vidas || 0,
                    total_inativos_individual: total_inativos_individual || 0,
                    total_inativos_familiar: total_inativos_familiar || 0,
                    detalhes_planos: typeof detalhes_planos === 'object' ? JSON.stringify(detalhes_planos) : detalhes_planos,
                    valor_individual: valor_individual || 0,
                    valor_familiar: valor_familiar || 0,
                    valor_manutencao: valor_manutencao || 0,
                    valor_total: valor_total || 0,
                    data_vencimento: data_vencimento || null,
                    observacoes: observacoes || null,
                    status: 'pendente',
                    fechado_por: user.nome || user.email || 'Sistema'
                }
            });

            if (!created) {
                await fatura.update({
                    total_vidas_individual: total_vidas_individual || fatura.total_vidas_individual,
                    total_vidas_familiar: total_vidas_familiar || fatura.total_vidas_familiar,
                    total_vidas: total_vidas || fatura.total_vidas,
                    total_inativos_individual: total_inativos_individual || fatura.total_inativos_individual,
                    total_inativos_familiar: total_inativos_familiar || fatura.total_inativos_familiar,
                    detalhes_planos: typeof detalhes_planos === 'object' ? JSON.stringify(detalhes_planos) : (detalhes_planos || fatura.detalhes_planos),
                    valor_individual: valor_individual || fatura.valor_individual,
                    valor_familiar: valor_familiar || fatura.valor_familiar,
                    valor_manutencao: valor_manutencao || fatura.valor_manutencao,
                    valor_total: valor_total || fatura.valor_total,
                    data_vencimento: data_vencimento || fatura.data_vencimento,
                    observacoes: observacoes !== undefined ? observacoes : fatura.observacoes,
                    fechado_por: user.nome || user.email || fatura.fechado_por
                });
            }

            return res.status(201).json({
                success: true,
                message: created ? "Fatura fechada com sucesso!" : "Fatura atualizada com sucesso!",
                fatura: fatura
            });

        } catch (err) {
            console.error("Erro ao fechar fatura:", err);
            return res.status(500).json({ success: false, message: "Erro interno ao fechar fatura." });
        }
    },

    /**
     * Atualiza o status de pagamento de uma fatura fechada (Pendente, Pago, Cancelado)
     */
    atualizarStatus: async (req, res) => {
        try {
            const user = req.user || {};
            const isMaster = user.autoridade === 1 || user.perfil === 'master';
            if (!isMaster) {
                return res.status(403).json({ success: false, message: "Apenas administradores master podem alterar o status de pagamento." });
            }

            const faturaId = req.params.id;
            const { status, data_pagamento, observacoes } = req.body;

            const fatura = await Faturamentos.findByPk(faturaId);
            if (!fatura) {
                return res.status(404).json({ success: false, message: "Fatura não encontrada." });
            }

            const updateData = {};
            if (status) updateData.status = status;
            if (data_pagamento !== undefined) updateData.data_pagamento = data_pagamento || null;
            if (observacoes !== undefined) updateData.observacoes = observacoes;

            if (status === 'pago' && !fatura.data_pagamento && !data_pagamento) {
                updateData.data_pagamento = new Date();
            }

            await fatura.update(updateData);

            return res.json({
                success: true,
                message: "Status da fatura atualizado com sucesso!",
                fatura: fatura
            });
        } catch (err) {
            console.error("Erro ao atualizar status da fatura:", err);
            return res.status(500).json({ success: false, message: "Erro interno ao atualizar fatura." });
        }
    },

    /**
     * Retorna os preços cadastrados na tabela oi_planos para o parceiro
     */
    getPlanos: async (req, res) => {
        try {
            const partnerId = req.params.id;
            const planos = await Planos.findAll({
                where: { id_franqueado: partnerId },
                raw: true
            });

            // Retorna a lista existente ou modelo padrão preenchido
            const precosFormatados = {
                individual: {
                    g: resolverPreco(planos, 'individual', 'g'),
                    p: resolverPreco(planos, 'individual', 'p'),
                    gp: resolverPreco(planos, 'individual', 'gp'),
                    gs: resolverPreco(planos, 'individual', 'gs'),
                    gsp: resolverPreco(planos, 'individual', 'gsp')
                },
                familiar: {
                    g: resolverPreco(planos, 'familiar', 'g'),
                    p: resolverPreco(planos, 'familiar', 'p'),
                    gp: resolverPreco(planos, 'familiar', 'gp'),
                    gs: resolverPreco(planos, 'familiar', 'gs'),
                    gsp: resolverPreco(planos, 'familiar', 'gsp')
                },
                manutencao_mensal: resolverManutencao(planos),
                customizado: planos.length > 0
            };

            return res.json(precosFormatados);
        } catch (err) {
            console.error("Erro ao obter planos do parceiro:", err);
            return res.status(500).json({ error: "Erro interno ao obter planos." });
        }
    },

    /**
     * Salva ou atualiza a tabela de preços do parceiro em oi_planos
     */
    salvarPlanos: async (req, res) => {
        try {
            const user = req.user || {};
            const isMaster = user.autoridade === 1 || user.perfil === 'master';
            if (!isMaster) {
                return res.status(403).json({ success: false, message: "Apenas administradores master podem alterar a tabela de preços." });
            }

            const partnerId = req.params.id;
            const { individual, familiar, manutencao_mensal } = req.body;

            const manutencao = !isNaN(Number(manutencao_mensal)) ? Number(manutencao_mensal) : 197.00;

            const tipos = ['g', 'p', 'gp', 'gs', 'gsp'];
            const itensParaSalvar = [];

            if (individual) {
                for (const t of tipos) {
                    if (individual[t] !== undefined && !isNaN(Number(individual[t]))) {
                        itensParaSalvar.push({
                            plano: 'individual',
                            tipo: t,
                            valor: Number(individual[t]),
                            manutencao_mensal: manutencao
                        });
                    }
                }
            }

            if (familiar) {
                for (const t of tipos) {
                    if (familiar[t] !== undefined && !isNaN(Number(familiar[t]))) {
                        itensParaSalvar.push({
                            plano: 'familiar',
                            tipo: t,
                            valor: Number(familiar[t]),
                            manutencao_mensal: manutencao
                        });
                    }
                }
            }

            // Atualiza cada plano usando findOrCreate
            for (const item of itensParaSalvar) {
                const [registro, created] = await Planos.findOrCreate({
                    where: {
                        id_franqueado: partnerId,
                        plano: item.plano,
                        tipo: item.tipo
                    },
                    defaults: {
                        valor: item.valor,
                        manutencao_mensal: item.manutencao_mensal
                    }
                });

                if (!created) {
                    await registro.update({
                        valor: item.valor,
                        manutencao_mensal: item.manutencao_mensal
                    });
                }
            }

            return res.json({
                success: true,
                message: "Tabela de preços atualizada com sucesso!"
            });

        } catch (err) {
            console.error("Erro ao salvar preços dos planos:", err);
            return res.status(500).json({ success: false, message: "Erro interno ao salvar preços." });
        }
    },

    /**
     * Retorna a lista detalhada de vidas ativas e inativas faturadas para auditoria e conferência
     */
    getVidasAuditoria: async (req, res) => {
        try {
            const partnerId = req.params.id;
            const user = req.user || {};
            const isMaster = user.autoridade === 1 || user.perfil === 'master';

            if (!isMaster && user.id && String(user.id) !== String(partnerId)) {
                return res.status(403).json({ success: false, message: "Acesso restrito." });
            }

            const { cobertura, serviceType, situacao, search } = req.query;
            const where = { id_franqueado: partnerId };

            if (cobertura) where.cobertura = cobertura;
            if (serviceType) where.serviceType = serviceType;
            if (situacao) where.situacao = situacao;

            if (search) {
                where[Op.or] = [
                    { nm_cliente: { [Op.like]: `%${search}%` } },
                    { nu_documento: { [Op.like]: `%${search}%` } }
                ];
            }

            const limit = parseInt(req.query.limit, 10) || 100;
            const page = parseInt(req.query.page, 10) || 1;
            const offset = (page - 1) * limit;

            const { count, rows } = await Clientes.findAndCountAll({
                where,
                order: [['nm_cliente', 'ASC']],
                limit,
                offset,
                attributes: ['id', 'nm_cliente', 'nu_documento', 'email', 'telefone', 'cobertura', 'serviceType', 'situacao', 'dtAtivacao', 'dtDesativacao', 'cpf_titular']
            });

            return res.json({
                total: count,
                page,
                totalPages: Math.ceil(count / limit),
                vidas: rows
            });
        } catch (err) {
            console.error("Erro ao buscar vidas para auditoria:", err);
            return res.status(500).json({ error: "Erro interno ao buscar vidas de auditoria." });
        }
    }
};