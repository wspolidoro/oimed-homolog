//CONFIGS
require('dotenv').config();

//SCHEMAS
const Clientes = require('../../schema/tb_clientes');
const Sleeping = require('../../schema/tb_sleeping');

//CONTROLLES
const { sleep, wakeUp } = require('../sleeping/index.js');
const { buscarClienteService } = require('../services/index.js');



module.exports = {
    loginConsulta: async (req, res) => {

        console.log("chamar control");
        console.log("verificando....:", req.body == 1);

        const cliente = await Clientes.findOne({
            where: { nu_documento: req.body.nuCpf },
            raw: true
        });


        if (cliente) {
            const cpf = cliente.nu_documento;
            const senha = cliente.nu_documento.slice(0, 4);
            console.log("cliente encontrado: ", cpf, senha, req.body.nuCpf, req.body.password);

            if (req.body.nuCpf == cpf && req.body.password == senha) {
                const isSleeping = await Sleeping.findOne({
                    where: { idVida: cpf },
                    raw: true
                });

                if (isSleeping) {
                    console.log("Cliente está dormindo:2", cpf);

                    const isWakeUp = await wakeUp(isSleeping.uuid);

                    if (isWakeUp) {
                        res.status(200).json({ success: true, message: "Operação realizada com sucesso!", urlRedirect: `https://oimed.rapidoc.tech/${process.env.CLIENT_ID}/beneficiary/${isSleeping.uuid}` });
                    }

                } else {//00057163731
                    console.log("Cliente não está dormindo:", cpf);
                    if (cliente.uuid) {
                        res.status(200).json({ success: true, message: "Operação realizada com sucesso!", urlRedirect: `https://oimed.rapidoc.tech/${process.env.CLIENT_ID}/beneficiary/${cliente.uuid}` });

                    } else {
                        const getCliente = await buscarClienteService(cpf);

                        await Clientes.update(
                            { uuid: getCliente.beneficiary.uuid },
                            { where: { nu_documento: cpf } }
                        );

                        res.status(200).json({ success: true, message: "Operação realizada com sucesso!", urlRedirect: `https://oimed.rapidoc.tech/${process.env.CLIENT_ID}/beneficiary/${getCliente.beneficiary.uuid}` });

                    }

                }
            } else {
                res.status(200).json({ success: false, message: "CPF ou Senha incorreto" })
            }


        } else {
            res.status(200).json({ success: false, message: "cliente não encontrado" })
        }

        //buscar dados pelo cpf na tabela de clientes
        /*      const cliente = await Clientes.findAll({
                 where: { nu_documento: req.body.login }
             });
     
             console.log(cliente) */

    }
}