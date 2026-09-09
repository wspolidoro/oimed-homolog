const { sequelize, sandbox } = require('../../db');
const { faker } = require('@faker-js/faker');
const SubFranqueado = require('../../schema/tb_sub_franqueado');
const SubClientes = require('../../schema/tb_sub_clientes.js');
const { parse } = require('csv-parse/sync');
const fs = require('fs');

//DEBBUG
const { sendMailError, mailerNewCadastro } = require('../../routs/sendMailer.js');

async function createClienteRecord(data) {
  //await sequelize.sync();
  console.log("Creating cliente record:", data);
  var cpfNumber = data.nu_documento;
  var numericCpfNumber = cpfNumber.replace(/\D/g, "");

  const arrayDefault = '[{"nm_cliente1":null,"nu_documento1":null,"birthday1":null,"email1":null,"telefone1":null,"zipCode1":null,"address1":null,"city1":null,"state1":null},{"nm_cliente2":null,"nu_documento2":null,"birthday2":null,"email2":null,"telefone2":null,"zipCode2":null,"address2":null,"city2":null,"state2":null},{"nm_cliente3":null,"nu_documento3":null,"birthday3":null,"email3":null,"telefone3":null,"zipCode3":null,"address3":null,"city3":null,"state3":null}]';

  const newCliente = await SubClientes.create({
    nm_cliente: data.nm_cliente,
    nu_documento: numericCpfNumber,
    birthday: data.birthday,
    telefone: data.telefone,
    email: data.email,
    zip_code: data.zip_code,
    address: data.address,
    city: data.city,
    state: data.state,
    dt_venda: "default",
    situacao: "Pendente",
    nu_parcelas: "default",
    vl_venda: "default",
    dt_cobranca: "default",
    dt_vencimento: "default",
    dt_pagamento: "default",
    par_atual: "default",
    paymentType: data.paymentType,
    serviceType: data.serviceType,
    link: data.link,
    beneficiarios: typeof data.beneficiarios === 'string' ? data.beneficiarios : JSON.stringify(data.beneficiarios || arrayDefault),
    id_franqueado: data.id_franqueado,
    cpf_titular: "titular"
  });

  const beneficiary = JSON.parse(typeof data.beneficiarios === 'string' ? data.beneficiarios : arrayDefault);
  for (const beneficiario of beneficiary) {
    const idx = beneficiary.indexOf(beneficiario) + 1;
    if (beneficiario["nm_cliente" + idx] != null) {
      await SubClientes.create({
        nm_cliente: beneficiario["nm_cliente" + idx],
        nu_documento: beneficiario["nu_documento" + idx],
        birthday: beneficiario["birthday" + idx],
        telefone: beneficiario["telefone" + idx],
        email: beneficiario["email" + idx],
        zip_code: beneficiario["zipCode" + idx],
        address: beneficiario["address" + idx],
        city: beneficiario["city" + idx],
        state: beneficiario["state" + idx],
        dt_venda: "default",
        situacao: "Pendente",
        nu_parcelas: "default",
        vl_venda: "default",
        dt_cobranca: "default",
        dt_vencimento: "default",
        dt_pagamento: "default",
        par_atual: "default",
        paymentType: data.paymentType,
        serviceType: data.serviceType,
        link: "default",
        beneficiarios: arrayDefault,
        id_franqueado: data.id_franqueado,
        cpf_titular: numericCpfNumber
      });
    }
  }

  return newCliente;
}

module.exports = {
  create: async (req, res) => {

    try {
      const newFranqueado = await SubFranqueado.create({
        idFranqueadoMaster: req.body.idFranqueadoMaster,
        nome: req.body.nome,
        cpf: req.body.cpf,
        telefone: req.body.telefone,
        email: req.body.email,
        password: faker.string.hexadecimal({ length: 12 }),
        total_clientes: '0',
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
      console.log(err);
    }

  },
  read: async (req, res) => {
    const listSubFranqueado = await SubFranqueado.findAll({
      where: {
        idFranqueadoMaster: req.params.id
      }
    });

    res.json(listSubFranqueado);

  },
  importClientes: async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });
    }

    try {
      const fileContent = fs.readFileSync(req.file.path, 'utf8');
      const cleanContent = fileContent.replace(/^\uFEFF/, '');
      const results = parse(cleanContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: ';'
      });

      fs.unlinkSync(req.file.path);

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const row of results) {
        console.log("Processing row:", row);
        try {
          const clienteData = {
            nm_cliente: row.nm_cliente,
            nu_documento: row.nu_documento,
            birthday: row.birthday,
            telefone: row.telefone,
            email: row['e-mail'],
            zip_code: row.zip_code || "00000000",
            address: row.address,
            city: row.city,
            state: row.state,
            paymentType: row.paymentType || 'default',
            serviceType: row.serviceType || 'default',
            link: row.link || 'default',
            beneficiarios: row.beneficiarios || '[{"nm_cliente1":null,"nu_documento1":null,"birthday1":null,"email1":null,"telefone1":null,"zipCode1":null,"address1":null,"city1":null,"state1":null},{"nm_cliente2":null,"nu_documento2":null,"birthday2":null,"email2":null,"telefone2":null,"zipCode2":null,"address2":null,"city2":null,"state2":null},{"nm_cliente3":null,"nu_documento3":null,"birthday3":null,"email3":null,"telefone3":null,"zipCode3":null,"address3":null,"city3":null,"state3":null}]',
            id_franqueado: row.id_franqueado
          };

          await createClienteRecord(clienteData);
          successCount++;
        } catch (err) {
          let errorMessage = err.message;
          for (const key in errorCodes) {
            if (err.message.includes(key) || err.message === key) {
              errorMessage = errorCodes[key];
              break;
            }
          }

          errorCount++;
          errors.push({ row: row, error: errorMessage });
        }
      }

      let statusCode = errors.length > 0 ? 400 : 200

      res.status(statusCode).json({
        success: errors.length > 0 ? false : true,
        message: errors.length > 0 ? `Falha na Importação: ${successCount} importados, ${errorCount} erros` : `Importação concluída: ${successCount} importados`,
        errors: errors.length > 0 ? errors : null
      });
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ success: false, message: err.message });
    }
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


const errorCodes = {
  'notNull Violation: oi_sub_clientes.id_franqueado cannot be null': 'Por favor, informe o ID do franqueado.',
  'notNull Violation: oi_sub_clientes.nm_cliente cannot be null': 'Por favor, informe o nome do cliente.',
  'notNull Violation: oi_sub_clientes.nu_documento cannot be null': 'Por favor, informe o número do documento.',
  'Validation error': "Registros duplicados não são permitidos. Por favor, verifique os dados e tente novamente.", 
};