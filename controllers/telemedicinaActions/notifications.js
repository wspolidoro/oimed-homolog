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
        nu_documento: '31231256231',
        /*   dtAtivacao: {
             //[Sequelize.Op.eq]: moment().subtract(1, 'months').add(1, 'days').startOf('day').toDate(), // 1 mês antes + 1 dia antes
             [Sequelize.Op.gte]: moment().subtract(1, 'months').add(7, 'days').startOf('day').toDate(), // 00:00:00 do dia
             [Sequelize.Op.lt]: moment().subtract(1, 'months').add(7, 'days').endOf('day').toDate(), // 23:59:59 do dia
             //[Sequelize.Op.lte]: moment().add(1, 'days').toDate(), // Pagamentos vencendo em 1 dia
           }, 
       reminderSent: false, */
      },
      include: {
        model: Franqueado,  // Inclui o modelo 'Franqueado'
        required: false,    // Define se a associação é obrigatória, ou seja, se você quer clientes mesmo sem franqueado
        attributes: ['id', 'siteEmail', 'siteTitle', 'site_venda']
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
      <html>
      <head>
        <style>
          p {
              line-height: 1.8;
              font-family: georgia, palatino, serif;
              font-size: 18px;
            }
        </style>
      </head>
       <body>
<p>
 <strong>MENSAGEM AUTOMÁTICA, POR GENTILEZA, NÃO RESPONDA</strong><br>
</p>
<p>
Olá,<br> 
Prezado(a) ${payment.nm_cliente}, esperamos essa mensagem lhe encontre, bem!<br>
Essa é uma mensagem automática para lembrá-lo, cordialmente, de que o pagamento referente ao seu plano de Telemedicina está próximo ao vencimento.<br> 
</p>
<p>
O pagamento está programado para vencer em 7 dias, no dia <strong>${dueDateNextMonth.format('DD-MM-YYYY')}</strong>.<br>
Por gentileza, verifique os detalhes referentes ao pagamento, e caso ache necessário, você poderá entrar em contato conosco, através de nosso<br>
 WhatsApp de Suporte em caso de dúvidas ou assistência para emissão de segunda vida de boleto. 
 </p>
<p>
Agradecemos por tê-lo(a) conosco, e por sua colaboração!
</p>
<p>
Atenciosamente,<br>
Equipe ${payment.siteTitle || "-"}.
</p>
<p>
WhatsApp Sac: ${payment.telefone || "-"}<br>
Site: ${payment.site_venda || "-"}
</p>


        </body>
        </html>
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
        nu_documento: '31231256231',
    /*     dtAtivacao: {
          //[Sequelize.Op.eq]: moment().subtract(1, 'months').add(1, 'days').startOf('day').toDate(), // 1 mês antes + 1 dia antes
          [Sequelize.Op.gte]: moment().subtract(1, 'months').add(1, 'days').startOf('day').toDate(), // 00:00:00 do dia
          [Sequelize.Op.lt]: moment().subtract(1, 'months').add(1, 'days').endOf('day').toDate(), // 23:59:59 do dia
          //[Sequelize.Op.lte]: moment().add(1, 'days').toDate(), // Pagamentos vencendo em 1 dia
        }, */
        reminderSent: 0,
      },
      include: {
        model: Franqueado,  // Inclui o modelo 'Franqueado'
        required: false,    // Define se a associação é obrigatória, ou seja, se você quer clientes mesmo sem franqueado
        attributes: ['id', 'siteEmail', 'siteTitle', 'site_venda']
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
 <html>
      <head>
        <style>    
          p {
              line-height: 1.8;
              font-family: georgia, palatino, serif;
              font-size: 18px;
            }
        </style>
      </head>
       <body>
<p>
<strong>MENSAGEM AUTOMÁTICA, POR GENTILEZA, NÃO RESPONDA</strong><br>
</p>
<p>
Olá,<br>
Prezado(a) ${payment.nm_cliente}, este é apenas um lembrete cordial, para para sinalizar que o pagamento referente ao seu serviço de Telemedicina
 está próximo e vence amanhã,
</p>
<p>
dia ${dueDateNextMonth.format('DD-MM-YYYY')}.
</p>

<p>
Por gentileza, certifique-se de que o pagamento seja realizado na data prevista para o vencimento, evitando assim, a inclusão de juros, ou,
<br> qualquer interrupção em seus serviços de Telemedicina.
</p>
  
<p>
Estamos à disposição em nosso WhatsApp de Suporte para qualquer assistência que você possa precisar.<br>
 Em caso de dúvidas, não hexite em nos enviar uma mensagem.
</p>
<p>
Atenciosamente, 
Equipe ${payment.siteTitle || "-"}<br>
</p>
<p>
WhatsApp Sac: ${payment.telefone}<br>
Site: ${payment.site_venda || "-"}
</p>

 </body>
        </html>
  `
        //`Olá, lembre-se de pagar o valor de R$${payment.amount} antes de ${moment(payment.dueDate).format('DD/MM/YYYY')}.`
      );

    }






    res.json({ success: true, message: payments })

  }
}



/* Olá, 
Prezado(a) ${payment.nm_cliente}, esperamos essa mensagem lhe encontre, bem!<br>

Gostaríamos de lembrá-lo que o pagamento referente ao seu plano de Telemedicina está próximo ao vencimento!<br> 

O pagamento está programado para vencer em 7 dias, no dia <strong>${dueDateNextMonth.format('DD-MM-YYYY')}</strong>. </p>

<p>Por favor, verifique os detalhes do pagamento, e se necessário, você poderá entrar em contato conosco em caso de dúvidas ou assistência.<br>

Agradecemos por tê-lo(a) conosco, e por sua colaboração!</p>

<p>Atenciosamente, Equipe ${payment.siteTitle || "-"}.<br>
${payment.telefone} */

/* 
Olá,
Prezado(a) ${payment.nm_cliente}, este é um lembrete cordial, para para sinalizar que o pagamento referente ao seu serviço de Telemedicina vence amanhã, dia ${dueDateNextMonth.format('DD-MM-YYYY')}. 

Por favor, certifique-se de que o pagamento seja realizado na data agendada, para evitar qualquer interrupção em seu serviço.

Estamos à disposição para qualquer dúvida ou assistência que você possa precisar.



Atenciosamente, Equipe ${payment.siteTitle || "-"}.
${payment.telefone} */