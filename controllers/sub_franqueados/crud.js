const { sequelize, sandbox } = require('../../db');
const { faker } = require('@faker-js/faker');
const SubFranqueado = require('../../schema/tb_sub_franqueado');
const SubClientes = require('../../schema/tb_sub_clientes.js');

//DEBBUG
const { sendMailError, mailerNewCadastro } = require('../../routs/sendMailer.js');

module.exports = {
    create: async (req, res) => {
        await sequelize.sync();

        try {
            const newFranqueado = await SubFranqueado.create({
                nome: req.body.nome,
                cpf: req.body.cpf,
                telefone: req.body.telefone,
                email: req.body.email,
                password: faker.string.hexadecimal({ length: 12 }),
                total_clientes: '3',
                vendas: '0',
                dado_banc: "-",
                dado_pix: "-",
                site_venda: "subpainel",
                status: 'ativo',
                perfil: 'guest',
                subPaineis: false
            });

            //console.log(req.body) 

            res.json(newFranqueado);
        } catch (err) {
            console.log(err)
        }

    },
    read: async (req, res) => {

        const listSubFranqueado = await SubFranqueado.findAll();

        res.json(listSubFranqueado);

    },
    createClientes: async (req, res) => {
        try {
            await sequelize.sync();
        
            console.log(req.body);
        
            var cpfNumber = req.body.nu_documento;
            var numericCpfNumber = cpfNumber.replace(/\D/g, "");
        
            const newCliente = await SubClientes.create({
              nm_cliente: req.body.nm_cliente,
              nu_documento: numericCpfNumber,
              birthday: req.body.birthday,
              telefone: req.body.telefone,
              email: req.body.email,
              zip_code: req.body.zip_code,
              address: req.body.address,
              city: req.body.city,
              state: req.body.state,
              dt_venda: "default",
              situacao: "Pendente",
              nu_parcelas: "default",
              vl_venda: "default",
              dt_cobranca: "default",
              dt_vencimento: "default",
              dt_pagamento: "default",
              par_atual: "default",
              paymentType: req.body.paymentType,
              serviceType: req.body.serviceType,
              link: req.body.link,
              beneficiarios: JSON.stringify(req.body.beneficiarios),
              id_franqueado: req.body.id_franqueado,
              cpf_titular: "titular"
            });
        
            try {
              if (newCliente.length > 0 && req.body.id_franqueado == 26) {
                await CriarUsuarioAlloyal(newCliente);
              }
            } catch (err) {
              console.log("erro na criação aloyal: ", err.message);
            }
        
        
        
        
        
        
            /* const idFranqueado = newCliente.dataValues.id_franqueado;
            const emaildestino = newCliente.dataValues.email;
        
            const dataFranqueado = await SubFranqueado.findAll({
              where: {
                id: idFranqueado
              }
            });
        
        
            let sending = await mailerNewCadastro(dataFranqueado[0].dataValues, emaildestino); */ //obj com dados dos cliente - msg padrão - msg de erro ou success - identificador do painel
        
        
            const arrayDefault = '[{"nm_cliente1":null,"nu_documento1":null,"birthday1":null,"email1":null,"telefone1":null,"zipCode1":null,"address1":null,"city1":null,"state1":null},{"nm_cliente2":null,"nu_documento2":null,"birthday2":null,"email2":null,"telefone2":null,"zipCode2":null,"address2":null,"city2":null,"state2":null},{"nm_cliente3":null,"nu_documento3":null,"birthday3":null,"email3":null,"telefone3":null,"zipCode3":null,"address3":null,"city3":null,"state3":null}]';
        
            if (newCliente) {
              const beneficiary = JSON.parse(req.body.beneficiarios);
              beneficiary.map(async (beneficiario, i) => {
                var contador = i + 1;
                if (beneficiario["nm_cliente" + contador] != null) {
                  const newBeneficiario = await SubClientes.create({
                    nm_cliente: beneficiario["nm_cliente" + contador],
                    nu_documento: beneficiario["nu_documento" + contador],
                    birthday: beneficiario["birthday" + contador],
                    telefone: beneficiario["telefone" + contador],
                    email: beneficiario["email" + contador],
                    zip_code: beneficiario["zipCode" + contador],
                    address: beneficiario["address" + contador],
                    city: beneficiario["city" + contador],
                    state: beneficiario["state" + contador],
                    dt_venda: "default",
                    situacao: "Pendente",
                    nu_parcelas: "default",
                    vl_venda: "default",
                    dt_cobranca: "default",
                    dt_vencimento: "default",
                    dt_pagamento: "default",
                    par_atual: "default",
                    paymentType: req.body.paymentType,
                    serviceType: req.body.serviceType,
                    link: "default",
                    beneficiarios: arrayDefault,
                    id_franqueado: req.body.id_franqueado,
                    cpf_titular: numericCpfNumber
                  });
        
        
        
                }
        
              });
              res.json({ success: true, message: "criado com sucesso" });
            }
        
        
        
            //res.json(newCliente);
        
          } catch (err) {
            console.log(err)
            res.json({ success: false, message: err });
            //return res.status(400).json(err)
          }
    }
}