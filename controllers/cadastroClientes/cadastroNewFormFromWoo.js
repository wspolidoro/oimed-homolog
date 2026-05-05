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

const defaultBeneficiarios = '[{"nm_cliente1":null,"nu_documento1":null,"birthday1":null,"email1":null,"telefone1":null,"zipCode1":null,"address1":null,"city1":null,"state1":null},{"nm_cliente2":null,"nu_documento2":null,"birthday2":null,"email2":null,"telefone2":null,"zipCode2":null,"address2":null,"city2":null,"state2":null},{"nm_cliente3":null,"nu_documento3":null,"birthday3":null,"email3":null,"telefone3":null,"zipCode3":null,"address3":null,"city3":null,"state3":null}]';

module.exports = {
  cadastrarVida: async (req, res) => {
    const order = req.body;
    if (!order || Object.keys(order).length === 0) {
      return res.status(400).json({ success: false, message: 'erro, corpo vazio' });
    }

    const metaValues = (order.meta_data || []).reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});

    const getMetaValue = (key) => metaValues[key] || null;

    const formatCpf = (value = '') => value.replace(/\D/g, '');

    const telefoneInformado = (numero = '') =>
      numero
        .replace(/\D/g, '')
        .replace(/^55/, '');

    const billing = order.billing || {};
    const rawCpf = billing.cpf || getMetaValue('_billing_cpf') || getMetaValue('billing_cpf') || '';
    const numericCpfNumber = formatCpf(rawCpf);

    if (!numericCpfNumber) {
      return res.status(400).json({ success: false, message: 'CPF do titular é obrigatório' });
    }

    const lineItems = order.line_items || [];
    const planType = lineItems.some((item) => /familiar/i.test(item.name || '')) ? 'familiar' : 'individual';

    console.log(planType, 'planType definido com base nos itens do pedido');

    const dependentMeta = ['dep01', 'dep02', 'dep03']
      .map((suffix, index) => {
        const name = getMetaValue(`_billing_nm_${suffix}`) || getMetaValue(`billing_nm_${suffix}`) || null;
        const rawCpfDep = getMetaValue(`_billing_cpf_${suffix}`) || getMetaValue(`billing_cpf_${suffix}`) || '';
        const phone = getMetaValue(`_billing_tel_${suffix}`) || getMetaValue(`billing_tel_${suffix}`) || '';
        const email = getMetaValue(`_billing_email_${suffix}`) || getMetaValue(`billing_email_${suffix}`) || null;
        const birthday = getMetaValue(`_billing_dt_nascimento_${suffix}`) || getMetaValue(`billing_dt_nascimento_${suffix}`) || null;
        const cpfDep = formatCpf(rawCpfDep);

        if (!name && !cpfDep && !email && !phone) {
          return null;
        }

        return {
          position: index + 1,
          name,
          cpf: cpfDep || null,
          birthday,
          email,
          phone,
        };
      })
      .filter(Boolean);

    const arrayBeneficiarios = dependentMeta.length
      ? dependentMeta.map((dep) => ({
          [`nm_cliente${dep.position}`]: dep.name,
          [`nu_documento${dep.position}`]: dep.cpf,
          [`birthday${dep.position}`]: dep.birthday,
          [`email${dep.position}`]: dep.email,
          [`telefone${dep.position}`]: telefoneInformado(dep.phone) || null,
          [`zipCode${dep.position}`]: billing.postcode || null,
          [`address${dep.position}`]: billing.address_1 || null,
          [`city${dep.position}`]: billing.city || null,
          [`state${dep.position}`]: billing.state || null,
          holder: numericCpfNumber,
          cobertura: 'familiar',
        }))
      : [];

    const idFranqueado = getMetaValue('_billing_id_franqueado') ||order.id_franqueado || req.body.id_franqueado || req.query.id_franqueado;
    if (!idFranqueado || Number(idFranqueado) === 40) {
      return res.status(400).json({ success: false, message: 'id_franqueado inválido ou inexistente' });
    }

    try {

      const billingPhone = billing.phone || billing.cellphone || '';
      const paymentType = order.payment_method || getMetaValue('paymentType') || 'woo';
      const serviceType = getMetaValue('serviceType') || 'G';
      const saleDate = order.date_paid || order.date_created || new Date().toISOString();
      const formattedAddress = `${billing.address_1 || ''}${billing.number ? `, ${billing.number}` : ''}`.trim() || 'Sem endereço, 0';

      const clientePayload = {
        nm_cliente: `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'Cliente WooCommerce',
        nu_documento: numericCpfNumber,
        birthday: getMetaValue('_billing_dt_nascimento_titular') || '0000-00-00',
        telefone: telefoneInformado(billingPhone) || '000000000',
        email: billing.email || 'cliente@sememail.com',
        zip_code: billing.postcode || '00000000',
        address: formattedAddress,
        city: billing.city || 'Sem cidade',
        state: billing.state || 'Sem estado',
        dt_venda: saleDate,
        situacao: 'Pendente',
        nu_parcelas: lineItems.length ? String(lineItems.length) : '1',
        vl_venda: order.total || '0',
        dt_cobranca: 'default',
        dt_vencimento: 'default',
        dt_pagamento: order.date_paid || 'default',
        par_atual: 'default',
        paymentType: "S",
        serviceType,
        link: order.payment_url || 'sem-link',
        beneficiarios: planType === 'familiar' && arrayBeneficiarios.length > 0
          ? JSON.stringify(arrayBeneficiarios)
          : defaultBeneficiarios,
        cobertura: planType,
        id_franqueado: idFranqueado,
        cpf_titular: "titular",
      };

      const newCliente = await Clientes.create(clientePayload);

      if (planType === 'familiar' && dependentMeta.length > 0) {
        for (const dep of dependentMeta) {
          if (!dep.cpf) {
            continue;
          }

          const dependentPayload = {
            nm_cliente: dep.name || `Dependente ${dep.position}`,
            nu_documento: dep.cpf,
            birthday: dep.birthday || '0000-00-00',
            telefone: telefoneInformado(dep.phone) || '000000000',
            email: dep.email || 'dependente@sememail.com',
            zip_code: billing.postcode || '00000000',
            address: formattedAddress,
            city: billing.city || 'Sem cidade',
            state: billing.state || 'Sem estado',
            dt_venda: saleDate,
            situacao: 'Pendente',
            nu_parcelas: '1',
            vl_venda: '0',
            dt_cobranca: 'default',
            dt_vencimento: 'default',
            dt_pagamento: 'default',
            par_atual: 'default',
            paymentType: "S",
            serviceType,
            link: order.payment_url || 'sem-link',
            beneficiarios: defaultBeneficiarios,
            cobertura: 'familiar',
            id_franqueado: idFranqueado,
            cpf_titular: numericCpfNumber,
          };

          await Clientes.create(dependentPayload);
        }
      }

      return res.json({ success: true, message: 'criado com sucesso' });
    } catch (err) {
      console.log('erro cadastroNewFormFromWoo.js', err);
      return res.status(400).json(err);
    }

    function alterarParaAtivo(client, body) {
      fetch(`https://parceiro.painelw.com.br/api/beneficiaries/create/${client.nu_documento}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then((x) => x.json())
        .then(async (fetchRes) => {
          if (fetchRes.success) {
            await Clientes.update({ situacao: 'ativo' }, {
              where: { nu_documento: fetchRes.beneficiaries[0].cpf },
            });
          }
        })
        .catch((error) => console.log('erro fetch alterarParaAtivo', error));
    }
  },
};
