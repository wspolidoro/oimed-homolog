//CONFIGS
require('dotenv').config();

//SCHEMAS
const Clientes = require('../../schema/tb_clientes');
const SubClientes = require('../../schema/tb_sub_clientes');
const Sleeping = require('../../schema/tb_sleeping');

//CONTROLLES
const { sleep, wakeUp } = require('../sleeping/index.js');
const { buscarClienteService } = require('../services/index.js');
const { ativarBeneficiarioSubpainel } = require('../sub_franqueados/ativarBeneficiario.js');



module.exports = {
    loginConsulta: async (req, res) => {
        try {
            console.log("chamar control", req.body);
            if (!req.body || !req.body.nuCpf || !req.body.password) {
                return res.status(200).json({ success: false, message: "CPF e senha são obrigatórios." });
            }

            const rawCpf = String(req.body.nuCpf).trim();
            const cleanCpf = rawCpf.replace(/\D/g, '');

            let cliente = await Clientes.findOne({
                where: { nu_documento: cleanCpf },
                raw: true
            });

            if (!cliente && cleanCpf !== rawCpf) {
                cliente = await Clientes.findOne({
                    where: { nu_documento: rawCpf },
                    raw: true
                });
            }

            let isSubCliente = false;

            if (!cliente) {
                cliente = await SubClientes.findOne({
                    where: { nu_documento: cleanCpf },
                    raw: true
                });

                if (!cliente && cleanCpf !== rawCpf) {
                    cliente = await SubClientes.findOne({
                        where: { nu_documento: rawCpf },
                        raw: true
                    });
                }

                if (cliente) {
                    isSubCliente = true;
                }
            }

            if (!cliente) {
                return res.status(200).json({ success: false, message: "Cliente não encontrado." });
            }

            const cpf = cliente.nu_documento;
            const cpfClean = String(cpf).replace(/\D/g, '');
            const senhaValida1 = cpfClean.slice(0, 4);
            const senhaValida2 = String(cpf).slice(0, 4);
            const senhaInput = String(req.body.password).trim();

            if (senhaInput !== senhaValida1 && senhaInput !== senhaValida2) {
                return res.status(200).json({ success: false, message: "CPF ou Senha incorreto." });
            }

            if (cliente.situacao && (cliente.situacao.toLowerCase() === 'inativo' || cliente.situacao.toLowerCase() === 'cancelado')) {
                return res.status(200).json({ 
                    success: false, 
                    message: "Seu cadastro encontra-se inativo. Entre em contato com o suporte." 
                });
            }

            if (isSubCliente) {
                try {
                    console.log("Ativando subcliente na base antes do login:", cpf);
                    await ativarBeneficiarioSubpainel(cpf);
                } catch (errAtivacao) {
                    console.log("Erro ao ativar subcliente na base antes do login:", errAtivacao);
                }
            }

            const isSleeping = await Sleeping.findOne({
                where: { idVida: cpf },
                raw: true
            });

            if (isSleeping) {
                console.log("Cliente está dormindo:2", cpf);
                try {
                    const isWakeUp = await wakeUp(isSleeping.uuid);
                    if (isWakeUp) {
                        return res.status(200).json({ 
                            success: true, 
                            message: "Operação realizada com sucesso!", 
                            urlRedirect: `https://atendimento.consultaonline.app.br/${process.env.CLIENT_ID}/beneficiary/${isSleeping.uuid}` 
                        });
                    }
                } catch (errWake) {
                    console.log("Erro ao acordar cliente:", errWake);
                }

                if (isSleeping.uuid) {
                    return res.status(200).json({ 
                        success: true, 
                        message: "Operação realizada com sucesso!", 
                        urlRedirect: `https://atendimento.consultaonline.app.br/${process.env.CLIENT_ID}/beneficiary/${isSleeping.uuid}` 
                    });
                }
            }

            // Cliente ativo com UUID preenchido
            if (cliente.uuid && typeof cliente.uuid === 'string' && cliente.uuid.trim() !== '') {
                return res.status(200).json({ 
                    success: true, 
                    message: "Operação realizada com sucesso!", 
                    urlRedirect: `https://atendimento.consultaonline.app.br/${process.env.CLIENT_ID}/beneficiary/${cliente.uuid.trim()}` 
                });
            }

            // Caso não tenha UUID gravado, tenta buscar na base de telemedicina
            try {
                const getCliente = await buscarClienteService(cpfClean || cpf);
                const beneficiaryUuid = getCliente?.beneficiary?.uuid;

                if (beneficiaryUuid) {
                    if (!isSubCliente) {
                        await Clientes.update(
                            { uuid: beneficiaryUuid },
                            { where: { nu_documento: cpf } }
                        );
                    }

                    return res.status(200).json({ 
                        success: true, 
                        message: "Operação realizada com sucesso!", 
                        urlRedirect: `https://atendimento.consultaonline.app.br/${process.env.CLIENT_ID}/beneficiary/${beneficiaryUuid}` 
                    });
                } else {
                    return res.status(200).json({ 
                        success: false, 
                        message: "Cadastro do beneficiário não localizado na base de consultas. Entre em contato com a administração." 
                    });
                }
            } catch (errBusca) {
                console.log("Erro ao buscar cliente na base mestra:", errBusca?.message || errBusca);
                return res.status(200).json({ 
                    success: false, 
                    message: "Cadastro ainda não ativado na base de consultas. Entre em contato com o suporte." 
                });
            }

        } catch (error) {
            console.log("erro geral no loginConsulta: ", error);
            return res.status(500).json({ success: false, message: "Ocorreu um erro ao processar a solicitação.", error: error.message });
        }

        //buscar dados pelo cpf na tabela de clientes
        /*      const cliente = await Clientes.findAll({
                 where: { nu_documento: req.body.login }
             });
     
             console.log(cliente) */

    }
}