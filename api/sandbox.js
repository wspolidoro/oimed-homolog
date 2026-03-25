//CONFIGS
const express = require('express');
const routerSandbox = express.Router();
const { sequelize, sandbox } = require('../db');

const axios = require('axios');
const jwt = require('jsonwebtoken');


//SCHEMAS
const Franqueado = require('../schema/test/tb_franqueado');
const Clientes = require('../schema/test/tb_clientes');
const Rapidoc = require('../schema/test/tb_rapidoc');

//LIBS
const { Op, Sequelize } = require('sequelize');

const secretKey = "@rfxzsklc_s+bg7t+@f6^obve=f!swr1%0838lctalor92visand-oimed";

//middleware
routerSandbox.use(function timelog(req, res, next) {
    console.log('Time: ', Date.now());
    next();
});

function auth(req, res, next) {
    const authToken = req.headers['authorization'];

    if (authToken != undefined) {

        const bearer = authToken.split(' ');
        let token = bearer[1];

        jwt.verify(token, secretKey, (err, data) => {
            if (err) {
                res.status(401);
                res.json({ success: false, message: "Token inválido" });
            } else {
                req.token = token;
                req.user = { id: data.id, nome: data.nome };

                next();
            }
        });

    } else {
        res.status(401);
        res.json({ success: false, message: "Token Inválido" });
    }

};

const credentials = [
    {
        id: 12,
        nome: "jose",
        api_key: "keytest33",
        secret_key: "secrettest33"
    }
]

routerSandbox.post('/auth', (req, res) => {
    var { api_key, secret_key } = req.body;
    let credentialKey = credentials.find(i => i.api_key == api_key);

    if (credentialKey != undefined) {
        if (credentialKey.secret_key == secret_key) {

            jwt.sign({ id: credentialKey.id, user: credentialKey.nome }, secretKey, { expiresIn: '1h' }, (err, token) => {
                if (err) {
                    res.status(400);
                    res.json({ err: "falha interna" });
                } else {
                    if (req.query.login == "true") {
                        res.json({ queryParam: "chave", token: token });
                    } else {
                        res.status(200);
                        res.json({ token: token });
                    }
                }
            });

        } else {
            res.status(401);
            res.json({ err: "Credenciais inválidas" });
        }
    } else {
        res.status(404);
        res.json({ err: "os dados enviados não existe" });
    }


});

/*--------implementação rapidoc------------*/

//inativar vida
routerSandbox.delete('/beneficiaries/inactivate/:cpf', auth, async (req, res) => {
    const cpf = req.params.cpf;

    try {
        const response = await axios.get(`${process.env.API_URL_TEST}/beneficiaries/${cpf}`, {
            headers: {
                'clientId': process.env.CLIENT_ID_TEST,
                'Authorization': process.env.AUTHORIZATION_TEST,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
            /*      headers: {
                     'clientId': process.env.CLIENT_ID_TEST,
                     'Authorization': process.env.AUTHORIZATION_TEST,
                     'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
                 } */
        });

        if (response.data.success == false) {
            res.status(404);
            res.json(response.data.message);
        } else {
            async function insertTableRapidoc() {
                const newRapidoc = await Rapidoc.create({
                    nome: response.data.beneficiary.name,
                    cpf: response.data.beneficiary.cpf,
                    uuid: response.data.beneficiary.uuid,
                    birthday: response.data.beneficiary.birthday
                })
            }

            insertTableRapidoc();

            const uuid = response.data.beneficiary.uuid;
            const retorno = await axios.delete(`${process.env.API_URL_TEST}/beneficiaries/${uuid}`, {
                headers: {
                    'clientId': process.env.CLIENT_ID_TEST,
                    'Authorization': process.env.AUTHORIZATION_TEST,
                    'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
                }
            });

            if (retorno.data.success === true) {
                const situacaoCliente = await Clientes.update({
                    uuid: retorno.data.beneficiary.uuid,
                    situacao: "inativo",
                }, {
                    where: { nu_documento: cpf }
                });


                res.json(retorno.data)
            }
        }
        /*  */
    } catch (err) {
        res.status(500);
        res.json(err);
        console.log(err)
    }


});

//reativar vida
routerSandbox.put('/beneficiaries/reactivate/:cpf', auth, async (req, res) => {
    const cpfinformed = req.params.cpf;

    const uuidGet = await Rapidoc.findAll({
        where: {
            cpf: cpfinformed
        }
    })


    if (uuidGet.length >= 1) {
        console.log(uuidGet.length)
        const uuid = uuidGet[0].uuid;
        const retorno = await axios.put(`${process.env.API_URL_TEST}/beneficiaries/${uuid}/reactivate`, "data", {
            headers: {
                'clientId': process.env.CLIENT_ID_TEST,
                'Authorization': process.env.AUTHORIZATION_TEST,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });

        console.log(retorno.data, uuid)

        if (retorno.data.success === true) {
            const situacaoCliente = await Clientes.update({
                uuid: retorno.data.beneficiary.uuid,
                situacao: "ativo",
            }, {
                where: { nu_documento: cpfinformed }
            });


            res.json(retorno.data)
        } else {
            res.json({ success: false, message: "falha ao reativar vida" });
        }
    } else {
        res.json({ success: false, message: "usuario não encontrado" });
    }



});

///ativar vida manualmente via painel oimed
routerSandbox.post('/beneficiaries/activate/:cpf', auth, async (req, res) => {
    const cpf = req.params.cpf;

    try {

        //buscar dados pelo cpf na tabela de clientes
        const cliente = await Clientes.findAll({
            where: { nu_documento: cpf }
        });

        if (cliente.length < 1) {
            res.status(404).json({ success: false, message: "Cliente não encontrado" });
            return;
        }

        console.log("cliente: ", cliente[0].id)
        //configuracao da data
        const myDate = cliente[0].birthday;

        const dia = myDate.substr(0, 2);
        const mes = myDate.substr(2, 2);
        const ano = myDate.substr(4, 4);

        const dataVerify = /\//.test(myDate);

        var modifieData1 = () => {
            const dataSplit = myDate.split('/');
            const format = `${dataSplit[2]}-${dataSplit[1]}-${dataSplit[0]}`;

            return format;
        };

        var modifieData2 = `${ano}-${mes}-${dia}`;

        const birthdayFormat = dataVerify ? modifieData1() : modifieData2; //formatar data para 0000-00-00

        //Array principal que vai para rapidoc
        const arrBD = [
            {
                "name": cliente[0].nm_cliente,
                "cpf": cliente[0].nu_documento,
                "birthday": birthdayFormat,
                "phone": cliente[0].telefone,
                "email": cliente[0].email,
                "zipCode": cliente[0].zip_code,
                "address": cliente[0].address,
                "city": cliente[0].city,
                "state": cliente[0].state,
                "plans": [
            {
                "paymentType": "S",
                "plan": {
                    "uuid": "6676fb40-4b2f-4434-bd9c-ba6f38925c44"
                }
            },
            {
                "paymentType": "S",
                "plan": {
                    "uuid": "07f2e6a3-3c4a-40a0-9473-f05b91f9b159"
                }
            }
        ]
                /*"paymentType": cliente[0].paymentType,
                "serviceType": "GSP",*/
                /* "plans": [
                    {
                        "paymentType": "S",
                        "plan": {
                            "uuid": "22bea4dd-ee7f-4c8b-8cd2-747e1752f72d"
                        }
                    }
                ], */
                /* "holder": "",
                "general": "" */
            }
        ];

        const arrBD1 = [
            {
                "name": "João Silva",
                "cpf": "38074501060",
                "birthday": "1984-12-12",
                "phone": "51993949830",
                "email": "rapidoc2025101501@gmail.com",
                "zipCode": "91060000",
                "address": "Rua Teste",
                "city": "Porto Alegre",
                "state": "RS",
                "plans": [
                    {
                        "paymentType": "S",
                        "plan": {
                            "uuid": "6676fb40-4b2f-4434-bd9c-ba6f38925c44"
                        }
                    }
                ]
            }
        ]


        /* [
          {
            "name": "João Silva",
            "cpf": "34088529014",
            "birthday": "1984-12-12",
            "phone": "51993949830",
            "email": "rapidoc2025101501@gmail.com",
            "zipCode": "91060000",
            "address": "Rua Teste",
            "city": "Porto Alegre",
            "state": "RS",
            "plans": [
              {
                "paymentType": "S",
                "plan": {
                  "uuid": "6676fb40-4b2f-4434-bd9c-ba6f38925c44"
                }
              }
            ]
          }
        ] */

        function isJsonString(str) {
            if (typeof (str) === "string") {
                return JSON.parse(str);
            }
            return str;
        }

        isJsonString(cliente[0].beneficiarios)


        const dataArrOrigin = JSON.parse(cliente[0].beneficiarios);
        const dataArr = isJsonString(cliente[0].beneficiarios);//JSON.parse(dataArrOrigin);
        console.log("dataArr: ", typeof (dataArr), dataArr);



        if (dataArr[0].nu_documento1 !== null) {
            const data = dataArr[0].birthday1.split('/');
            const birthdayFormat1 = data ? data : null;


            const dep1 = {
                "name": dataArr[0].nm_cliente1,
                "cpf": dataArr[0].nu_documento1,
                "birthday": `${birthdayFormat1[2]}-${birthdayFormat1[1]}-${birthdayFormat1[0]}`,
                "phone": dataArr[0].telefone1,
                "email": dataArr[0].email1,
                "zipCode": dataArr[0].zipCode1,
                "address": dataArr[0].address1,
                "city": dataArr[0].city1,
                "state": dataArr[0].state1
            }

            arrBD.push(dep1);
        } else if (dataArr[1].nu_documento2 !== null) {
            const data = dataArr[1].birthday1.split('/');
            const birthdayFormat2 = data ? data : null;

            const dep2 = {
                "name": dataArr[1].nm_cliente2,
                "cpf": dataArr[1].nu_documento2,
                "birthday": `${birthdayFormat2[2]}-${birthdayFormat2[1]}-${birthdayFormat2[0]}`,
                "phone": dataArr[1].telefone2,
                "email": dataArr[1].email2,
                "zipCode": dataArr[1].zipCode2,
                "address": dataArr[1].address2,
                "city": dataArr[1].city2,
                "state": dataArr[1].state2
            }

            arrBD.push(dep2);
        } else if (dataArr[2].nu_documento3 !== null) {
            const data = dataArr[2].birthday1.split('/');
            const birthdayFormat3 = data ? data : null;

            const dep3 = {
                "name": dataArr[2].nm_cliente3,
                "cpf": dataArr[2].nu_documento3,
                "birthday": `${birthdayFormat3[2]}-${birthdayFormat3[1]}-${birthdayFormat3[0]}`,
                "phone": dataArr[2].telefone3,
                "email": dataArr[2].email3,
                "zipCode": dataArr[2].zipCode3,
                "address": dataArr[2].address3,
                "city": dataArr[2].city3,
                "state": dataArr[2].state3
            };

            arrBD.push(dep3);
        }

        console.log("origewm: ", arrBD);

        const response = await axios.post(`${process.env.API_URL_TEST}/beneficiaries`, arrBD, {
            headers: {
                'clientId': process.env.CLIENT_ID_TEST,
                'Authorization': process.env.AUTHORIZATION_TEST,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });



        if (response.data.success == true) {
            const situacaoCliente = await Clientes.update({
                uuid: response.data.beneficiaries[0].uuid,
                situacao: "ativo",
            }, {
                where: { id: cliente[0].id }
            });

            //acão para registrar ativaçao da vida na rapidoc
            const franqueado = await Franqueado.findAll({
                where: { id: cliente[0].id_franqueado }
            });

            let vidasAtivas = franqueado[0].vendas;

            const novaVida = await Franqueado.update({
                vendas: parseInt(vidasAtivas) + 1,
            }, {
                where: {
                    id: cliente[0].id_franqueado,
                }
            });

            //resposta para o cliente
            res.send(response.data);
            console.log("criado: ", response.data);
            return true;
        } else {
            res.send(response.data);
            console.log("erro ao criar: ", response.data);
            return false;
        }

    } catch (err) {
        console.log(err.response.data)
        res.status(500).json({ success: false, message: "erro interno" });
    }
});

//consultar por cpf na rapidoc
routerSandbox.get('/consulta/oimed/:cpf', auth, async (req, res) => {
    const cliente = await Clientes.findOne({
        where: {
            nu_documento: req.params.cpf
        },
        raw: true,
        attributes: ['nm_cliente', 'nu_documento', 'birthday', 'telefone', 'email', 'zip_code', 'address', 'city', 'state', 'situacao', 'serviceType']
    });

    if (cliente) {
        res.status(200).json({ success: true, data: cliente });
    } else {
        res.status(404).json({ success: false, message: "Cliente não encontrado" });
    }
    /* const response = await axios.get(`${process.env.API_URL_TEST}/beneficiaries/${req.params.cpf}`, {
        headers: {
            'clientId': process.env.CLIENT_ID_TEST,
            'Authorization': process.env.AUTHORIZATION_TEST,
            'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
        }
    });
    console.log("very: ", response.data)

    res.status(200);
    res.json(response.data); */
})

///ativação de dependentes
routerSandbox.post('/ativacao/te', async (req, res) => {
    const { name,
        cpf,
        birthday,
        phone,
        email,
        zipCode,
        address,
        city,
        state,
        holder } = req.body
    //rota de testes para reservar clientes rapidoc
    try {




        const birthdayFormat = birthday.split('/'); //formatar data para 0000-00-00

        //Array principal que vai para rapidoc
        const arrBD = [
            {
                "name": name,
                "cpf": cpf,
                "birthday": `${birthdayFormat[2]}-${birthdayFormat[1]}-${birthdayFormat[0]}`,
                "phone": phone,
                "email": email,
                "zipCode": zipCode,
                "address": address,
                "city": city,
                "state": state,
                "holder": holder,
            }
        ];

        const response = await axios.post(`${process.env.API_URL_TEST}/beneficiaries`, arrBD, {
            headers: {
                'clientId': process.env.CLIENT_ID_TEST,
                'Authorization': process.env.AUTHORIZATION_TEST,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });



        if (response.data.success == true) {
            res.send(response.data);
            console.log("if: ", response.data);
            return true;
        } else {
            res.send(response.data);
            console.log("else: ", response.data);
            return false;
        }

    } catch (err) {
        res.status(400).json(err);
        console.log(err.response.data)
    }


});

//rota de testes para reservar clientes
routerSandbox.post('/franqueado/clientes', auth, async (req, res) => {
    console.log(req.body);
    try {

        var cpfNumber = req.body.nu_documento;
        var numericCpfNumber = cpfNumber.replace(/\D/g, "");

        const existingCliente = await Clientes.findOne({
            where: {
                nu_documento: numericCpfNumber
            }
        });

        if (existingCliente) {
            return res.status(400).json({ success: false, message: "Cliente já cadastrado" });
        }

        const newCliente = await Clientes.create({
            nm_cliente: req.body.nm_cliente,
            nu_documento: numericCpfNumber,
            birthday: req.body.birthday,
            telefone: req.body.telefone,
            email: req.body.email,
            zip_code: req.body.zip_code,
            address: req.body.address,
            city: req.body.city,
            state: req.body.state,
            dt_venda: "default",
            situacao: "Pendente",
            nu_parcelas: "default",
            vl_venda: "default",
            dt_cobranca: "default",
            dt_vencimento: "default",
            dt_pagamento: "default",
            par_atual: "default",
            paymentType: "S",
            serviceType: req.body.serviceType,
            link: "https://www.testes.com",
            beneficiarios: '[{ "nm_cliente1": null, "nu_documento1": null, "birthday1": null, "email1": null, "telefone1": null, "zipCode1": null, "address1": null, "city1": null, "state1": null }, { "nm_cliente2": null, "nu_documento2": null, "birthday2": null, "email2": null, "telefone2": null, "zipCode2": null, "address2": null, "city2": null, "state2": null }, { "nm_cliente3": null, "nu_documento3": null, "birthday3": null, "email3": null, "telefone3": null, "zipCode3": null, "address3": null, "city3": null, "state3": null }]',
            id_franqueado: req.body.idParceiro,
            cpf_titular: "titular"
        });


        res.json(newCliente);

    } catch (err) {
        res.json(err);
        console.log(err)
    }

});

//rota para reservar dependente
routerSandbox.post('/beneficiaries/dependente', auth, async (req, res) => {
    console.log('%cteste', 'background-color: red', req.body)
    criarDependenteGeral()

    async function criarDependenteGeral() {
        const arrayDefault = '[{"nm_cliente1":null,"nu_documento1":null,"birthday1":null,"email1":null,"telefone1":null,"zipCode1":null,"address1":null,"city1":null,"state1":null},{"nm_cliente2":null,"nu_documento2":null,"birthday2":null,"email2":null,"telefone2":null,"zipCode2":null,"address2":null,"city2":null,"state2":null},{"nm_cliente3":null,"nu_documento3":null,"birthday3":null,"email3":null,"telefone3":null,"zipCode3":null,"address3":null,"city3":null,"state3":null}]';

        const {
            nm_cliente,
            nu_documento,
            birthday,
            telefone,
            email,
            zip_code,
            address,
            city,
            state,
            paymentType,
            serviceType,
            cpfTitular
        } = req.body;

        if (!cpfTitular || cpfTitular === "string") {
            return res.json({ success: false, message: "titular não informado" });
        }


        const clientes = await Clientes.findAll({
            where: { nu_documento: cpfTitular },
            raw: true,
            attributes: ['nm_cliente', 'id_franqueado', 'paymentType', 'serviceType']
        });

        console.log('cliente: ', clientes)

        if (clientes.length < 1) {
            return res.json({ success: false, message: "titular não cadastrado" });
        }


        const newBeneficiario = await Clientes.create({
            nm_cliente: nm_cliente,
            nu_documento: nu_documento,
            birthday: birthday,
            telefone: telefone,
            email: email,
            zip_code: zip_code,
            address: address,
            city: city,
            state: state,
            dt_venda: "default",
            situacao: "Pendente",
            nu_parcelas: "default",
            vl_venda: "default",
            dt_cobranca: "default",
            dt_vencimento: "default",
            dt_pagamento: "default",
            par_atual: "default",
            paymentType: "S",
            serviceType: clientes[0].serviceType,
            link: "default",
            beneficiarios: arrayDefault,
            id_franqueado: clientes[0].id_franqueado,
            cpf_titular: cpfTitular
        });


        res.json({ success: true, message: "criado com sucesso" });


    };
})

//rota para editar clientes
routerSandbox.put('/beneficiaries/edit/:cpf', auth, async (req, res) => {
    req.body.paymentType = "S";

    const nuDoc = req.params.cpf;
    //console.log('%cteste', 'background-color: red', req.params.nuDoc)


    const arrayDefault = '[{"nm_cliente1":null,"nu_documento1":null,"birthday1":null,"email1":null,"telefone1":null,"zipCode1":null,"address1":null,"city1":null,"state1":null},{"nm_cliente2":null,"nu_documento2":null,"birthday2":null,"email2":null,"telefone2":null,"zipCode2":null,"address2":null,"city2":null,"state2":null},{"nm_cliente3":null,"nu_documento3":null,"birthday3":null,"email3":null,"telefone3":null,"zipCode3":null,"address3":null,"city3":null,"state3":null}]';

    const {
        nm_cliente,
        nu_documento,
        birthday,
        telefone,
        email,
        zip_code,
        address,
        city,
        state
    } = req.body;

    if (!nuDoc || nuDoc === "string") {
        return res.json({ success: false, message: "titular não informado" });
    }

    const cleanedData = [req.body].map(item => {
        return Object.entries(item).reduce((acc, [key, value]) => {
            // 1. Limpa espaços em branco se for string
            const trimmedValue = typeof value === 'string' ? value.trim() : value;

            // 2. Define o que deve ser REMOVIDO
            const isInvalidString = trimmedValue === 'string';
            const isEmpty = trimmedValue === '';
            const isNull = trimmedValue === null;

            // 3. Só adiciona ao novo objeto (acc) se NÃO for inválido
            if (!isInvalidString && !isEmpty && !isNull) {
                acc[key] = trimmedValue;
            }

            return acc;
        }, {});
    });

    const uuidGet = await Clientes.findAll({
        where: { nu_documento: nuDoc }
    });

    const objUpdate = {
        "name": cleanedData[0].nm_cliente,
        "birthday": cleanedData[0].birthday,
        "phone": cleanedData[0].telefone,
        "email": cleanedData[0].email,
        "zipCode": cleanedData[0].zip_code,
        "address": cleanedData[0].address,
        "city": cleanedData[0].city,
        "state": cleanedData[0].state,
        "plans": [
            {
                "paymentType": "S",
                "plan": {
                    "uuid": "6676fb40-4b2f-4434-bd9c-ba6f38925c44"
                }
            },
            {
                "paymentType": "S",
                "plan": {
                    "uuid": "07f2e6a3-3c4a-40a0-9473-f05b91f9b159"
                }
            }
        ]
        /* "paymentType": "S",
        "serviceType": cleanedData[0].serviceType */
    }

    if (uuidGet[0].situacao === "ativo") {
        try {
            const response = await axios.put(`${process.env.API_URL_TEST}/beneficiaries/${uuidGet[0].uuid}`, objUpdate, {
                headers: {
                    'clientId': process.env.CLIENT_ID_TEST,
                    'Authorization': process.env.AUTHORIZATION_TEST,
                    'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
                }
            });

            if (response.data.success == false) {
                return res.json({ success: false, message: "não foi possível atualizar" });
            }
        } catch (err) {
            console.log(err.response.data)
            return res.json(err.response.data);
        }
    }




    const atualiazarBeneficiario = await Clientes.update(cleanedData[0],
        {
            where: { nu_documento: nuDoc }
        });

    ///console.log("very: ", atualiazarBeneficiario)

    if (atualiazarBeneficiario[0] == 1) {
        res.json({ success: true, message: "atualizado com sucesso" });
    } else {
        res.json({ success: false, message: "falha na atualização, o cpf informado não existe" });
    }





})

//rota de testes para autenticar sessão de usuario via url
routerSandbox.post('/franqueado/login', auth, async (req, res) => {

    res.json({ success: true, message: "token válido" })

});

//buscar especialidades
routerSandbox.get('/oimed/specialties', auth, async (req, res) => {
    const response = await axios.get(`${process.env.API_URL_TEST}/specialties`, {
        headers: {
            'clientId': process.env.CLIENT_ID_TEST,
            'Authorization': process.env.AUTHORIZATION_TEST,
            'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
        }
    });


    res.status(200);
    res.json({ success: true, data: response.data });
});

//buscar disponibilidade por especialidade
routerSandbox.post('/oimed/specialty-availability', auth, async (req, res) => {
    const { dateInitial, dateFinal, beneficiaryUuid, specialtyUuid } = req.body;

    try {
        const uuid = await axios.get(`${process.env.API_URL_TEST}/beneficiaries/${beneficiaryUuid}`, {
            headers: {
                'clientId': process.env.CLIENT_ID_TEST,
                'Authorization': process.env.AUTHORIZATION_TEST,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });

        if (uuid.data.success == false) {
            return res.status(404).json({ success: false, message: "Beneficiário não encontrado" });
        }


        const response = await axios.get(`${process.env.API_URL_TEST}/specialty-availability?specialtyUuid=${specialtyUuid}&dateInitial=${dateInitial}&dateFinal=${dateFinal}&beneficiaryUuid=${uuid.data.beneficiary.uuid}`, {
            headers: {
                'clientId': process.env.CLIENT_ID_TEST,
                'Authorization': process.env.AUTHORIZATION_TEST,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });

        res.status(200);
        res.json({ success: true, data: response.data });
        console.log("resposta disponibilidade: ", response.data)
    } catch (error) {
        console.log(error.response.data)

        res.status(500).json({ success: false, message: error.response.data.message });
    }

})

//rota para criar agendamentos
routerSandbox.post('/oimed/appointments', auth, async (req, res) => {
    const { beneficiaryUuid, availabilityUuid, specialtyUuid, approveAdditionalPayment } = req.body;
    try {
        const uuid = await axios.get(`${process.env.API_URL_TEST}/beneficiaries/${beneficiaryUuid}`, {
            headers: {
                'clientId': process.env.CLIENT_ID_TEST,
                'Authorization': process.env.AUTHORIZATION_TEST,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });

        if (uuid.data.success == false) {
            return res.status(404).json({ success: false, message: "Beneficiário não encontrado" });
        }

        const response = await axios.post(`${process.env.API_URL_TEST}/appointments`, {
            "beneficiaryUuid": uuid.data.beneficiary.uuid,
            "availabilityUuid": availabilityUuid,
            "specialtyUuid": specialtyUuid,
            "approveAdditionalPayment": true
        }, {
            headers: {
                'clientId': process.env.CLIENT_ID_TEST,
                'Authorization': process.env.AUTHORIZATION_TEST,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });

        console.log("resposta agendamento: ", response.data)
        res.status(200);
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.log(error.response.data)
        const textOriginal = "Parâmetro availabilityUuid já utilizado em outro agendamento.";
        const text2 = "Beneficiário já possui agendamento marcado para a mesma especialidade"
        const text3 = "Especialidade informada não pertence ao profissional"

        if (textOriginal === error.response.data.message) {
            return res.status(400).json({ success: false, message: "Já existe um agendamento para esse cpf" });
        }

        if (error.response.data.message.includes(text2)) {
            return res.status(400).json({ success: false, message: "O usuário já possui um agendamento para essa especialidade" });
        }

        if (error.response.data.message.includes(text3)) {
            return res.status(400).json({ success: false, message: "Especialidade informada não pertence ao profissional. Verifique os dados e tente novamente" });
        }

        res.status(500).json({ success: false, message: error.message });
    }

})

//rota para ler agendamentos por uuid
routerSandbox.get('/oimed/appointments/list/:uuid', auth, async (req, res) => {

    try {
        const response = await axios.get(`${process.env.API_URL_TEST}/appointments`, {
            headers: {
                'clientId': process.env.CLIENT_ID_TEST,
                'Authorization': process.env.AUTHORIZATION_TEST,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });
        ///${req.params.uuid}

        //const filteredAppointments = response.data.filter(appointment => appointment.beneficiary.cpf === req.params.uuid);

        const filteredAppointments = response.data
            .filter(appointment => appointment.beneficiary.cpf === req.params.uuid)
            .map(({ beneficiary, createdBy, ...rest }) => rest);
        // Aqui pegamos o 'beneficiary' para fora e retornamos apenas o resto (...rest)

        console.log("aS", response.data)

        if (filteredAppointments.length === 0) {
            return res.status(404).json({ success: false, message: "Agendamentos não encontrados" });
        }

        res.status(200);
        res.json({ success: true, data: filteredAppointments });
    } catch (error) {
        console.log(error, 1)
        /*         const textOriginal = "Parâmetro availabilityUuid já utilizado em outro agendamento.";
        
                if (textOriginal === error.response.data.message) {
                    return res.status(400).json({ success: false, message: "Já existe um agendamento para esse cpf" });
                } */

        res.status(500).json({ success: false, message: error.message });
    }

})

//rota para deletar agendamentos por uuid
routerSandbox.delete('/oimed/appointments/:uuid', auth, async (req, res) => {

    try {

        const response = await axios.delete(`${process.env.API_URL_TEST}/appointments/${req.params.uuid}`, {
            headers: {
                'clientId': process.env.CLIENT_ID_TEST,
                'Authorization': process.env.AUTHORIZATION_TEST,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });

        console.log("resposta agendamento: ", response)
        res.status(200);
        res.json({ success: true, data: response.data });
    } catch (error) {
        //console.log(error, 1)

        const textOriginal = "Não é permitido cancelamento com menos de 48 horas de antecedência.";

        if (textOriginal === error.response.data.message) {
            return res.status(400).json({ success: false, message: "Não é permitido cancelamento com menos de 48 horas de antecedência." });
        }

        res.status(500).json({ success: false, message: error.message });
    }

})

//rota para realizar SSO
routerSandbox.post('/oimed/sso/callback/:id', auth, async (req, res) => {
    const beneficiaryUuid = req.params.id;



    if (!beneficiaryUuid || beneficiaryUuid === "string") {
        return res.status(400).json({ success: false, message: "ID inválido" });
    }

    const response = await axios.get(`${process.env.API_URL_TEST}/beneficiaries/${beneficiaryUuid}`, {
        headers: {
            'clientId': process.env.CLIENT_ID_TEST,
            'Authorization': process.env.AUTHORIZATION_TEST,
            'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
        }
    });

    if (response.data.message && response.data.message === "Beneficiário não encontrado.") {
        return res.status(404).json({ success: false, message: "Beneficiário não encontrado" });
    }
    const uuid = response.data.beneficiary.uuid;

    //res.status(200).json({ success: true, message: "Autenticação realizada com sucesso", urlRedirect: `https://oimed.rapidoc.tech/${process.env.CLIENT_ID_TEST}/beneficiary/${uuid}` });
    res.status(200).json({ success: true, message: "Autenticação realizada com sucesso", urlRedirect: `https://atendimento.consultaonline.app.br/5fac4f05-0b92-450f-ad4a-ccd9b3ffce32/beneficiary/${uuid}` });

})


module.exports = routerSandbox;