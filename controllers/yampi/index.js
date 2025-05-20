const { sequelize, sandbox } = require('../../db');
const { faker } = require('@faker-js/faker');
const SubFranqueado = require('../../schema/tb_sub_franqueado');
const SubClientes = require('../../schema/tb_sub_clientes.js');
const CartPanda = require('../../schema/tb_cart_panda.js');

//DEBBUG

module.exports = {
    listOrder: async (req, res) => {

        const cliente = await CartPanda.findOne({
            where: {
                nu_documento: req.params.cpf
            },
            raw: true
        });
        
        let orderId = cliente.order_id;

        const url = 'https://accounts.cartpanda.com/api/v3/conecta-med/orders/' + orderId;
        const options = {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer h8sv1qYPtGzOhIGX6j6gGbD7dTnMaJBN1Q4WWz8RlC2XWhp5FcsPC6kaVwAc'
            }
        };

        try {
            const response = await fetch(url, options);
            const data = await response.json();
            res.json({success: true, data: data.order})
        } catch (error) {
            console.error(error);
        }
    },
    webhook: async (req, res) => {
        const data = req.body;

        if (data.event === "order.created") {
            let cpf = data.order.customer.cpf;
            const registerOrder = await CartPanda.create({
                nu_documento: cpf.replace(/[\.-]/g, ""),
                order_id: data.order.id,
                status_payment: data.order.payment_status
            })
        }


        res.send("ok")
    }
}