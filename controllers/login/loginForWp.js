//CONFIGS
const express = require('express');
const { sequelize, sandbox } = require('../../db');
const axios = require('axios');
const { faker } = require('@faker-js/faker');

//SCHEMAS
const Franqueado = require('../../schema/tb_franqueado');
const Clientes = require('../../schema/tb_clientes');
const Rapidoc = require('../../schema/tb_rapidoc');



module.exports = {
    loginWp: async (req, res) => {

        console.log("chamar control");
        console.log("verificando....:", req.body == 1);



        //buscar dados pelo cpf na tabela de clientes
        const cliente = await Clientes.findAll({
            where: { nu_documento: req.body.login }
        });

        console.log(cliente)

    }
}