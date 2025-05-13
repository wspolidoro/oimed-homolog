const { sequelize, sandbox } = require('../../db');
const { faker } = require('@faker-js/faker');
const SubFranqueado = require('../../schema/tb_sub_franqueado');
const SubClientes = require('../../schema/tb_sub_clientes.js');

//DEBBUG

module.exports = {
    listOrder: async (req, res) => {
        const options = {
            method: 'GET',
            headers: {
                'User-Token': '2ACm86PyPeanlQYfNELf4D1ezOE1JPqtg3ajIMYy ',
                'User-Secret-Key': 'sk_zpGL51hpCQm97xGTBZMysUDxfTq2jfexV9Y8f'
            }
        };

        fetch('https://api.dooki.com.br/v2/conecta-med/orders?cpf='+req.params.cpf, options)
            .then(response => response.json())
            .then(response => {
                const qtdaOrder = response.data.length - 1;
                const data = response.data[qtdaOrder].status;
                console.log(qtdaOrder, response.data[qtdaOrder].status)

                res.json({success: true, data: data})

            })
            .catch(err => console.error(err));
    }
}