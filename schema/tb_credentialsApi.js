const { DataTypes } = require('sequelize');
const { sequelize, sandbox } = require('../db');

const CredentialsApi = sequelize.define('oi_credential', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_franqueado: {
        type: DataTypes.INTEGER,
        allowNull: false 
    },
    nome: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    modo: {
        type: DataTypes.STRING(8),
        allowNull: false
    },
    api_key: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    secret_key: {
        type: DataTypes.STRING(500),
        allowNull: false
    },
    status: {
        type: DataTypes.STRING(10),
        allowNull: false
    }
}, {
    tableName: 'oi_credentials',
    timestamps: true
});

module.exports = CredentialsApi;