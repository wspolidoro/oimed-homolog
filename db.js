const Sequelize = require('sequelize');
/* const sequelize = new Sequelize('oimed_db', 'root', 'root', {
    dialect: 'mysql',
    host: 'localhost',
    port: 3307
}); */
const sequelize = new Sequelize('oimedint', 'oimeduser', 'pass@oimed', {
    dialect: 'mysql',
    host: 'oimedbd.z4you.com.br',
    //port: 3306
});

const sandBox = new Sequelize('painelw_oimed_api', 'painelw_painelw', '@W}oI[0h!obE', {
    dialect: 'mysql',
    host: '51.222.94.129',
    port: 3306
});

module.exports = {
    "sequelize": sequelize,
    "sandbox": sandBox
};


