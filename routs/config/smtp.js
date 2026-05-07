/* module.exports = {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: 'devkledisom@gmail.com',
        pass: "cbdq osve xpov vsio"//"ynpp dyky wvyq jhxo",//'mhhipphoaubheehg' //senha de app
    }

}; */

module.exports = {
    host: "mail.painelw.com.br", // Substitua pelo seu host do cPanel
    port: 465,
    secure: true, // true para porta 465
    auth: {
        user: "noreply@painelw.com.br", // Seu e-mail completo
        pass: "H8GR3?ii=?opFd*="        // A senha que você criou no cPanel
    },
    tls: {
        // Isso ajuda se o seu certificado SSL for auto-assinado ou tiver problemas de cadeia
        rejectUnauthorized: false 
    }
};
//link para gerar senha de aplicativo no gmail
//https://myaccount.google.com/apppasswords