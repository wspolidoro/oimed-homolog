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
    host: process.env.SMTP_HOST || "mail.painelw.com.br",
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER || "noreply@painelw.com.br",
        pass: process.env.SMTP_PASS || "H8GR3?ii=?opFd*="
    },
    tls: {
        rejectUnauthorized: false 
    }
};
//link para gerar senha de aplicativo no gmail
//https://myaccount.google.com/apppasswords