//CONFIGS
const express = require('express');
const { sequelize, sandbox } = require('../../db');
const axios = require('axios');
const { faker } = require('@faker-js/faker');

//LIBS
const { Op, Sequelize } = require('sequelize');
const moment = require('moment');

//SCHEMAS
const Franqueado = require('../../schema/tb_franqueado');
const Clientes = require('../../schema/tb_clientes');
const Rapidoc = require('../../schema/tb_rapidoc');

//modules
const { mailerPaymentReminder } = require('../../routs/sendMailer.js');



module.exports = {
  paymentReminder7: async (req, res) => {

    console.log("chamar control");
    console.log("verificando....:", req.body == 1);

    const payments = await Clientes.findAll({
      where: {
        //nu_documento: '31231256231',
           dtAtivacao: {
              //[Sequelize.Op.eq]: moment().subtract(1, 'months').add(1, 'days').startOf('day').toDate(), // 1 mês antes + 1 dia antes
              [Sequelize.Op.gte]: moment().subtract(1, 'months').add(7, 'days').startOf('day').toDate(), // 00:00:00 do dia
              [Sequelize.Op.lt]: moment().subtract(1, 'months').add(7, 'days').endOf('day').toDate(), // 23:59:59 do dia
              //[Sequelize.Op.lte]: moment().add(1, 'days').toDate(), // Pagamentos vencendo em 1 dia
            }, 
        reminderSent: false,
      },
      include: {
        model: Franqueado,  // Inclui o modelo 'Franqueado'
        required: false,    // Define se a associação é obrigatória, ou seja, se você quer clientes mesmo sem franqueado
        attributes: ['id', 'siteEmail', 'siteTitle']
      }
    });

    console.log(payments.length)

    for (const payment of payments) {

      let startDate = moment(payment.dtAtivacao, 'YYYY-MM-DD');

      // Data de vencimento do mês atual
      let dueDateCurrentMonth = moment(startDate).startOf('month').add(startDate.date() - 1, 'days');

      // Data de vencimento do próximo mês
      let dueDateNextMonth = moment(startDate).add(1, 'month').startOf('month').add(startDate.date() - 1, 'days');

      console.log(payment.oi_franqueado.siteEmail, dueDateNextMonth.format('DD-MM-YYYY'))

      await mailerPaymentReminder(
        ['bell@ziiz.com.br', 'dev@ziiz.com.br'],
        payment.oi_franqueado.siteEmail,
        payment.email,
        'Lembrete de Pagamento - Faltam 7 dias!',
        `
  Olá, 
  Prezado(a) ${payment.nm_cliente}, esperamos essa mensagem lhe encontre, bem!
  
  Gostaríamos de lembrá-lo que o pagamento referente ao seu plano de Telemedicina está próximo ao vencimento! 
  
  O pagamento está programado para vencer em 7 dias, no dia ${dueDateNextMonth.format('DD-MM-YYYY')}. 
  
  Por favor, verifique os detalhes do pagamento, e se necessário, você poderá entrar em contato conosco em caso de dúvidas ou assistência.
  
  Agradecemos por tê-lo(a) conosco, e por sua colaboração!
  
  Atenciosamente, Equipe ${payment.siteTitle || "-"}.
  ${payment.telefone}
  `
      );
    }

    res.json({ success: true, message: payments })

  },
  paymentReminder1: async (req, res) => {

    console.log("chamar control");
    console.log("verificando....:", req.body == 1);

    const payments = await Clientes.findAll({
      where: {
                 dtAtivacao: {
                  //[Sequelize.Op.eq]: moment().subtract(1, 'months').add(1, 'days').startOf('day').toDate(), // 1 mês antes + 1 dia antes
                  [Sequelize.Op.gte]: moment().subtract(1, 'months').add(1, 'days').startOf('day').toDate(), // 00:00:00 do dia
                  [Sequelize.Op.lt]: moment().subtract(1, 'months').add(1, 'days').endOf('day').toDate(), // 23:59:59 do dia
                  //[Sequelize.Op.lte]: moment().add(1, 'days').toDate(), // Pagamentos vencendo em 1 dia
                },
                reminderSent: false, 
      },
      include: {
        model: Franqueado,  // Inclui o modelo 'Franqueado'
        required: false,    // Define se a associação é obrigatória, ou seja, se você quer clientes mesmo sem franqueado
        attributes: ['id', 'siteEmail', 'siteTitle']
      }
    });

    console.log(payments.length)

    for (const payment of payments) {
      let startDate = moment(payment.dtAtivacao, 'YYYY-MM-DD');

      // Data de vencimento do mês atual
      let dueDateCurrentMonth = moment(startDate).startOf('month').add(startDate.date() - 1, 'days');

      // Data de vencimento do próximo mês
      let dueDateNextMonth = moment(startDate).add(1, 'month').startOf('month').add(startDate.date() - 1, 'days');

      await mailerPaymentReminder(
        ['bell@ziiz.com.br', 'dev@ziiz.com.br'],
        payment.oi_franqueado.siteEmail,
        payment.email,
        'Lembrete de Pagamento - Seu Plano de Telemedicina Vence Amanhã!',
        `
  Olá,
  Prezado(a) ${payment.nm_cliente}, este é um lembrete cordial, para para sinalizar que o pagamento referente ao seu serviço de Telemedicina vence amanhã, dia ${dueDateNextMonth.format('DD-MM-YYYY')}. 
  
  Por favor, certifique-se de que o pagamento seja realizado na data agendada, para evitar qualquer interrupção em seu serviço.
  
  Estamos à disposição para qualquer dúvida ou assistência que você possa precisar.
  
  
  
  Atenciosamente, Equipe ${payment.siteTitle || "-"}.
  ${payment.telefone}
  `
        //`Olá, lembre-se de pagar o valor de R$${payment.amount} antes de ${moment(payment.dueDate).format('DD/MM/YYYY')}.`
      );

    }






    res.json({ success: true, message: payments })

  }
}