//CONFIGS
const express = require('express');
const { sequelize, sandbox } = require('../../db');
const axios = require('axios');
const { faker } = require('@faker-js/faker');

//SCHEMAS
const Franqueado = require('../../schema/tb_franqueado');
const Clientes = require('../../schema/tb_clientes');
const Rapidoc = require('../../schema/tb_rapidoc');
const CartPanda = require('../../schema/tb_cart_panda.js');

//CONTROLLERS
const controlAtivarVida = require('../telemedicinaActions/actions');


module.exports = {
  cadastrarVida: async (req, res) => {

    console.log(req.body.id_franqueado);

    //BLOQUEAR CLIENTE
    if (Object.keys(req.body).length < 1 || req.body.id_franqueado == 40) {
      res.json({ success: false, message: "erro, corpo vazio" });
      return;
    }

    console.log("chegando na rota " + req.query.familiar, req.body)
    const planFamiliar = req.query.familiar;

    function formatCpf(nu_cpf) {
      var cpfNumber = nu_cpf;
      var numericCpfNumber = cpfNumber.replace(/\D/g, "");
      return numericCpfNumber;
    };

    let telefoneInformado = (numero) => {
      return numero
        .replace(/\D/g, '')     // Remove tudo que não for dígito
        .replace(/^55/, '');    // Remove o 55 do começo, se existir
    }

    const beneficiarioArray = [];

    if (planFamiliar == "true") {
      beneficiarioArray.push(
        {
          "nm_cliente1": req.body.nm_cliente1 || null,
          "nu_documento1": formatCpf(req.body.nu_documento1) || null,
          "birthday1": req.body.birthday1 || null,
          "email1": req.body.email1 || null,
          "telefone1": telefoneInformado(req.body.telefone1) || null,
          "zipCode1": "57200000" || null,
          "address1": req.body.address1 || null,
          "city1": req.body.city1 || null,
          "state1": req.body.state1 || null,
          "holder": numericCpfNumber,
          "cobertura": "familiar"
        },
        {
          "nm_cliente2": req.body.nm_cliente2 || null,
          "nu_documento2": formatCpf(req.body.nu_documento2) || null,
          "birthday2": req.body.birthday2 || null,
          "email2": req.body.email2 || null,
          "telefone2": telefoneInformado(req.body.telefone2) || null,
          "zipCode2": "57200000" || null,
          "address2": req.body.address2 || null,
          "city2": req.body.city2 || null,
          "state2": req.body.state2 || null,
          "holder": numericCpfNumber,
          "cobertura": "familiar"
        },
        {
          "nm_cliente3": req.body.nm_cliente3 || null,
          "nu_documento3": formatCpf(req.body.nu_documento3) || null,
          "birthday3": req.body.birthday3 || null,
          "email3": req.body.email3 || null,
          "telefone3": telefoneInformado(req.body.telefone3) || null,
          "zipCode3": "57200000" || null,
          "address3": req.body.address3 || null,
          "city3": req.body.city3 || null,
          "state3": req.body.state3 || null,
          "holder": numericCpfNumber,
          "cobertura": "familiar"
        }
      );
    }


    const arrayDefault = '[{"nm_cliente1":null,"nu_documento1":null,"birthday1":null,"email1":null,"telefone1":null,"zipCode1":null,"address1":null,"city1":null,"state1":null},{"nm_cliente2":null,"nu_documento2":null,"birthday2":null,"email2":null,"telefone2":null,"zipCode2":null,"address2":null,"city2":null,"state2":null},{"nm_cliente3":null,"nu_documento3":null,"birthday3":null,"email3":null,"telefone3":null,"zipCode3":null,"address3":null,"city3":null,"state3":null}]';

    // console.log(typeof(planFamiliar), planFamiliar);
    //res.send("ok")
    // console.log(req.body);

    if (Object.keys(req.body).length < 1) {
      console.log("objet avaliado")
      return;
    }


    try {
      //await sequelize.sync();

      console.log("kledisom testando", req.body);
      console.log(JSON.stringify(arrayDefault))


      var cpfNumber = req.body.nu_documento;
      var numericCpfNumber = cpfNumber.replace(/\D/g, "");

      const cliente = await CartPanda.findOne({
        where: {
          nu_documento: numericCpfNumber,
          status_payment: 3
        }
      });

      const newCliente = await Clientes.create({
        nm_cliente: req.body.nm_cliente,
        nu_documento: numericCpfNumber,
        birthday: req.body.birthday,
        telefone: telefoneInformado(req.body.telefone),
        email: req.body.email,
        zip_code: "57200000",//req.body.zip_code,
        address: "rua de teste, 01",//req.body.address,
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
        beneficiarios: planFamiliar == 'true' ? JSON.stringify(beneficiarioArray) : JSON.stringify(arrayDefault),
        cobertura: planFamiliar == 'true' ? "familiar" : "individual",
        id_franqueado: req.body.id_franqueado,
        cpf_titular: "titular"
      });

      console.log(newCliente.nm_cliente, cliente)

      //ativar na Rapidoc
      if (cliente) {
        console.log("testessssssssss", newCliente)
        alterarParaAtivo(newCliente);
      }


      if (newCliente && planFamiliar == "true") {
        console.log('veryjkdshfkjlhsdgdsfh')
        //const beneficiary = JSON.parse(req.body.beneficiarios);
        beneficiarioArray.map(async (beneficiario, i) => {
          var contador = i + 1;
          //console.log(beneficiario)
          if (beneficiario["nm_cliente" + contador] != null) {
            const newBeneficiario = await Clientes.create({
              nm_cliente: beneficiario["nm_cliente" + contador],
              nu_documento: beneficiario["nu_documento" + contador],
              birthday: beneficiario["birthday" + contador],
              telefone: telefoneInformado(beneficiario["telefone" + contador]),
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
              link: req.body.link,
              beneficiarios: arrayDefault,
              cobertura: planFamiliar == 'true' ? "familiar" : "individual",
              id_franqueado: req.body.id_franqueado,
              cpf_titular: numericCpfNumber
            });



          }

        });

        //ativar na Rapidoc
        if (req.body.situacao == "ativo") {
          setTimeout(function () {
            //controlAtivarVida.ativar(req, res)
          }, 5000);
          //alterarParaAtivo(newCliente);
        }

        res.json({ success: true, message: "criado com sucesso" });

      } else {
        //ativar na Rapidoc
        if (req.body.situacao == "ativo") {
          setTimeout(function () {
            //controlAtivarVida.ativar(req, res)
          }, 5000);
          //alterarParaAtivo(newCliente);

        }

        res.json({ success: true, message: "criado com sucesso" });
      }

      function alterarParaAtivo(client) {
        //https://apioimed.z4you.com.br/beneficiaries/create/
        fetch(`https://parceiro.painelw.com.br/api/beneficiaries/create/${client.nu_documento}`,
          {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
          })
          .then((x) => x.json())
          .then(async (res) => {
            console.log("novo fetch: ", res);
            if (res.success) {

              const cliente = await Clientes.update({
                situacao: "ativo",
              }, {
                where: {
                  nu_documento: res.beneficiaries[0].cpf,
                }
              });


            }
          });
      };




      //res.json(newCliente);

    } catch (err) {
      console.log(err)
      console.log("erro casdastroNewForm.js linha 189")
      return res.status(400).json(err)
    }

  }
}