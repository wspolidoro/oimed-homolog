const Sequelize = require('sequelize');
const { sequelize, sandbox } = require('../db');

const Sleeping = sequelize.define('oi_sleeping', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },

    idVida: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    uuid: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
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

module.exports = Sleeping;