const nodemailer = require('nodemailer');

const SMTP_CONFIG = require('./config/smtp');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    secure: false,
    auth: {
        user: SMTP_CONFIG.auth.user,
        pass: SMTP_CONFIG.auth.pass

    },
    tls: {
        rejectUnauthorized: false,
    }
});

async function sendMailError(data, msg, msgErro, nu_painel, status) {

    //variaveis do corpo de envio do email com variação de idiomas para o novo aluno


    const mailSentPT = await transporter.sendMail({
        from: '"kledisom" <devkledisom@gmail.com>',
        to: ['dev@ziiz.com.br', 'kledison2009@hotmail.com', 'wspolidoro@gmail.com', 'gerencia@oimed.com.br', 'bell@ziiz.com.br'],
        subject: `OIMED INFORMA! ${status}`,
        text: `OIMED INFORMA! Segue em anexo sua ficha de inscrição`,
        html: `
        <h2>${msg}</h2>
        <h5>Painel: ${nu_painel}</h5>
        <p>${JSON.stringify(data)}</p>
        <br />
        <h2>Erros</h2>
        <p>${JSON.stringify(msgErro)}</p>
        `
        /*       attachments: [
                  {
                      path: path
                  }
              ] */
    });
    return mailSentPT
    //---------------------------------------------------------------------------------->

};

async function mailerNewCadastro(data, emaildestino) {

    //variaveis do corpo de envio do email com variação de idiomas para o novo aluno

    const mailSentPT = await transporter.sendMail({
        from: `${data.siteTitle} <${data.siteEmail}>`,
        to: emaildestino,
        bcc: "naoresponda@painelw.com.br",
        subject: `${data.siteTitle} INFORMA!`,
        text: `${data.siteTitle} INFORMA!`,
        html: `
        <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pedido Recebido!</title>
</head>
<body>
    <p>De: <strong>${data.siteTitle}</strong> &lt;${data.siteEmail}&gt;</p>
    <p>Assunto: <strong>Pedido Recebido!</strong></p>
    
    <p>Obrigado por fazer o pedido!</p>

    <p>Recebemos seu pedido com sucesso e assim que o pagamento for confirmado, você estará pronto para aproveitar todos os benefícios do melhor plano de saúde online, ${data.siteTitle}!</p>

    <h3>Aqui estão os detalhes para acessar sua conta:</h3>

    <p><strong>Website:</strong> <a href="${data.site_venda}">${data.site_venda}</a></p>

    <p>Também estamos disponíveis nas lojas de aplicativos:</p>

    <ul>
        <li><strong>Google Play Store:</strong> <a href="${data.linkAndroid}">${data.linkAndroid}</a></li>
        <li><strong>Apple App Store:</strong> <a href="${data.linkApple}">${data.linkApple}</a></li>
    </ul>

    <h3>Para acessar sua conta:</h3>
    <ul>
        <li>Pelo link web, o acesso é imediato.</li>
        <li>Nos aplicativos, o cadastro pode levar até 24 horas para ser ativado.</li>
    </ul>

    <h3>Dados de acesso:</h3>
    <p><strong>CPF:</strong> [Insira seu CPF]</p>
    <p><strong>Senha:</strong> Os 4 primeiros dígitos do seu CPF</p>

    <p>Nossa equipe de suporte está pronta para ajudar caso você precise de alguma assistência. Entre em contato conosco pelo e-mail: <a href="mailto:${data.siteEmail}">${data.siteEmail}</a>.</p>

    <p>Seja bem-vindo(a) à ${data.siteTitle} e aproveite os benefícios do nosso plano de saúde online!</p>

    <hr>
    <p>--</p>
    <p>Este e-mail foi enviado de um formulário de contato em <strong>${data.siteTitle}</strong> (<a href="${data.site_venda}">${data.site_venda}</a>)</p>
</body>
        `
        /*       attachments: [
                  {
                      path: path
                  }
              ] */
    });
    return mailSentPT
    //---------------------------------------------------------------------------------->

};

async function mailerNewCadastroConnectVitta(data, emaildestino) {

    //variaveis do corpo de envio do email com variação de idiomas para o novo aluno

    const mailSentPT = await transporter.sendMail({
        from: `${data.siteTitle} <${data.siteEmail}>`,
        to: emaildestino,
        bcc: "naoresponda@painelw.com.br",
        subject: `${data.siteTitle} INFORMA!`,
        text: `${data.siteTitle} INFORMA!`,
        html: `
        <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pedido Recebido!</title>
</head>
<body>
    <p>De: <strong>${data.siteTitle}</strong> &lt;${data.siteEmail}&gt;</p>
    <p>Assunto: <strong>Pedido Confirmado! Bem-vindo à ConectVitta!
</strong></p>


         <div class="container">
        <h1>Olá e bem-vindo(a) à ConectVitta!</h1>
        <p>Estamos muito felizes em tê-lo(a) conosco! Nosso plano de Telemedicina foi pensado para trazer mais praticidade e cuidado à sua vida.</p>

        <p>Seu pedido foi recebido com sucesso!</p>
        <p>Assim que o pagamento for confirmado em nosso sistema, você terá acesso completo a um dos melhores planos de Telemedicina do Brasil e poderá aproveitar todos os benefícios que a Conectvitta oferece.</p>

        <div class="instrucao-acesso">
            <h2>Instrução de Acesso a Nossa Plataforma de Consultas:</h2>
            <ul>
                <li>Site ConectVitta: <a href="https://conectvitta.com.br/app" target="_blank" rel="noopener noreferrer">https://conectvitta.com.br/app</a></li>
                <li>Aplicativo ConectVitta: <a href="https://conectvitta.com.br/" target="_blank" rel="noopener noreferrer">https://conectvitta.com.br/</a></li>
            </ul>
            <div class="dados-acesso">
                <p>Para acessar, insira os seguintes dados:</p>
                <ul>
                    <li><strong>Login:</strong> [Insira seu CPF]</li>
                    <li><strong>Senha:</strong> Os 4 primeiros dígitos do mesmo CPF.</li>
                </ul>
            </div>
            <p>Fique à vontade para realizar suas consultas em nossa plataforma com o botão de Teleconsulta no site através do computador, ou, pelo nosso aplicativo através do celular.</p>
        </div>

        <div class="redes-sociais">
            <h2>Acompanhe nossas novidades nas redes sociais!</h2>
            <p>Fique por dentro de todas as vantagens e novidades seguindo nossas páginas:</p>
            <ul>
                <li>Instagram: <a href="https://www.instagram.com/conectvitta?igsh=eW1lbjEwcmIzcGtt" target="_blank" rel="noopener noreferrer" class="link-rede-social">https://www.instagram.com/conectvitta?igsh=eW1lbjEwcmIzcGtt</a></li>
                <li>Facebook: <a href="https://www.facebook.com/share/1DPkP5N4uf/" target="_blank" rel="noopener noreferrer" class="link-rede-social">https://www.facebook.com/share/1DPkP5N4uf/</a></li>
                <li>TikTok: <a href="https://www.tiktok.com/@conectvitta?_t=ZM-8vOgxi6PuAJ&_r=1" target="_blank" rel="noopener noreferrer" class="link-rede-social">https://www.tiktok.com/@conectvitta?_t=ZM-8vOgxi6PuAJ&_r=1</a></li>
                <li>LinkedIn: <a href="https://www.linkedin.com/company/106616916/admin/dashboard/" target="_blank" rel="noopener noreferrer" class="link-rede-social">https://www.linkedin.com/company/106616916/admin/dashboard/</a></li>
            </ul>
        </div>

        <div class="manual-instrucoes">
            <h2>Manual de Instruções de Uso Conectvitta Telemedicina</h2>
            <p>Nós lhe enviamos um manual de orientação de como utilizar a Telemedicina da Conectvitta, totalmente completo, com todas as informações necessárias para lhe auxiliar no uso de seu plano escolhido de Telemedicina.</p>
            <p><a href="https://conectvitta.com.br/wp-content/uploads/2025/04/MANUAL-CONECTVITTA-1.pdf" target="_blank" rel="noopener noreferrer">Manual Conectvitta: https://conectvitta.com.br/wp-content/uploads/2025/04/MANUAL-CONECTVITTA-1.pdf</a></p>
        </div>

        <div class="ajuda">
            <h2>Ainda precisa de ajuda? Estamos aqui para você!</h2>
            <p>Caso tenha dúvidas ou ainda encontre alguma dificuldade, nossa equipe de suporte está sempre pronta para ajudar através de nosso WhatsApp de Suporte.</p>
            <p>Entre em contato com nosso Suporte através do WhatsApp: <a href="https://api.whatsapp.com/send?phone=5521972480417" target="_blank" rel="noopener noreferrer" class="whatsapp-suporte">(21) 97248-0417 📲</a></p>
            <p>Atendimento de segunda a sexta-feira, das 9h às 18h.</p>
        </div>

        <p class="agradecimento">Muito obrigado por escolher a ConectVitta! 💜</p>
        <p>Conte conosco para cuidar de sua saúde e de sua família!</p>
    </div>

</body>
        `
        /*       attachments: [
                  {
                      path: path
                  }
              ] */
    });
    return mailSentPT
    //---------------------------------------------------------------------------------->

};

async function mailerPaymentReminder(ccEmails, from, to, subject, text) {

    //variaveis do corpo de envio do email com variação de idiomas para o novo aluno

    const mailSentPT = await transporter.sendMail({
       from,
       to,
       cc: ccEmails.join(', '),  // Junta os emails para CC
       subject,
       html: text
    });
    return mailSentPT
    //---------------------------------------------------------------------------------->

};

module.exports = {
    sendMailError,
    mailerNewCadastro,
    mailerPaymentReminder,
    mailerNewCadastroConnectVitta
};



