require('dotenv').config();
const Sequelize = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'painelw_oimed_prod',
  process.env.DB_USER || 'painelw_painelw',
  process.env.DB_PASS || '@W}oI[0h!obE',
  {
    dialect: 'mysql',
    host: process.env.DB_HOST || '51.222.94.129',
    port: Number(process.env.DB_PORT) || 3306,
    logging: false
  }
);

const sandBox = new Sequelize(
  process.env.SANDBOX_DB_NAME || 'painelw_oimed_api',
  process.env.SANDBOX_DB_USER || 'painelw_painelw',
  process.env.SANDBOX_DB_PASS || '@W}oI[0h!obE',
  {
    dialect: 'mysql',
    host: process.env.SANDBOX_DB_HOST || '51.222.94.129',
    port: Number(process.env.SANDBOX_DB_PORT) || 3306,
    logging: false
  }
);

module.exports = {
  sequelize: sequelize,
  sandbox: sandBox
};



