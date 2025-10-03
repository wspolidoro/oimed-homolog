const Sequelize = require('sequelize');
const { sequelize, sandbox } = require('../db');

const Planos = sequelize.define('oi_planos', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },

    id_franqueado: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    plano: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    tipo: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    valor: {
        type: Sequelize.DECIMAL(10,2),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    manutencao_mensal: {
        type: Sequelize.DECIMAL(10,2),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    createdAt: {
        type: Sequelize.DATE
    },

    updatedAt: {
        type: Sequelize.DATE
    }

});

module.exports = Planos;