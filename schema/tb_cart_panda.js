const Sequelize = require('sequelize');
const { sequelize, sandbox } = require('../db');

const CartPanda = sequelize.define('oi_cart_pandas', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },

    nu_documento: {
        type: Sequelize.STRING(11),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    order_id: {
        type: Sequelize.STRING(40),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    status_payment: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    

});


module.exports = CartPanda;