//CONFIGS
const express = require('express');
const routerApi = express.Router();
const database = require('../db');
const axios = require('axios');
const jwt = require('jsonwebtoken');

//SCHEMAS
const Franqueado = require('../schema/tb_franqueado');
const Clientes = require('../schema/tb_clientes');
const Rapidoc = require('../schema/tb_rapidoc');

//LIBS
const { Op, Sequelize } = require('sequelize');

const secretKey = "@rfxzsklc_s+bg7t+@f6^obve=f!swr1%0838lctalor92vi";

//middleware
routerApi.use(function timelog(req, res, next) {
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
        api_key: "keyteste",
        secret_key: "secretteste"
    }
]

routerApi.post('/auth', (req, res) => {
    var { api_key, secret_key } = req.body;
    let credentialKey = credentials.find(i => i.api_key == api_key);
    console.log(api_key)

    if (credentialKey != undefined) {
        if (credentialKey.secret_key == secret_key) {

            jwt.sign({ id: credentialKey.id, user: credentialKey.nome }, secretKey, { expiresIn: '60s' }, (err, token) => {
                if (err) {
                    res.status(400);
                    res.json({ err: "falha interna" });
                } else {
                    res.status(200);
                    res.json({ token: token });
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
routerApi.delete('/beneficiaries/inactivate/:cpf', auth, async (req, res) => {
    const cpf = req.params.cpf;

    try {
        const response = await axios.get(`https://api.rapidoc.tech/tema/api/beneficiaries/${cpf}`, {
            headers: {
                'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
                'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
            /*      headers: {
                     'clientId': 'd13f4321-f78e-4261-b9d6-f741da923d72',
                     'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M-VtcJUO5XiDH9ImsqUswxOXv3v9pmVh_6UsuDHoOmLUnmITAh248cplIpccmQDQHBXkp68aiw90JFZuTn3c45_HrWmGdpRxt8wIwxBHimXD8bt0IY2mU3BUSvjy4p36mEuZsINjfwOOib9CZQBljKcg9UbhbDQckUFvs-Q5MF6NKFqqLL360OzhdMtcENIhOZC4qKdgfLSR5xLPaJf6CZew6YiSeuS1jlzIBxgwB2VkI4CdrjyeaVoIewy-qldf4mGu6QC16GAOWnFAs4z6YxWaQ9j-dgoZSDNOiaaJ3363blck8T0wAXJmRsMz0TezOlXthrwY2l8McctMrlyTgeBA8Ny7tztH5CQEug78bul4HfAH5gtZ-xiUPJo_pYqm4fJ4udx5t8HShHGJMxAc81imX5mF7ZAWXSyPEeWGVZqCjK49Dh96VHlTRlQXfImHOQvMIIALTrDmT6J9XIp3v5DkXdc2CjC36q0UKnFeDSDoP08_KJlbWhbRiYgD1vIKEgx1RxyFGASVY1DtkYruytRtk9qow7Cpo95WPiCrqDDBN92rn6XcdO4_NlLPzysr9FsYwwVPSl5MDehtx8Kl2mJREH0Xv0GHeULKcMtp_UEvgeqMtD8LT5y7Nem01OZaMoVJUIYehlGwvZPE_6IqMaloSqO8UWix9SrN_z_bagA',
                     'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
                 } */
        });

        if (response.data.success == false) {
            res.status(404);
            res.json(response.data.message);
        } else {
            async function insertTableRapidoc() {
                await database.sync();
                const newRapidoc = await Rapidoc.create({
                    nome: response.data.beneficiary.name,
                    cpf: response.data.beneficiary.cpf,
                    uuid: response.data.beneficiary.uuid,
                    birthday: response.data.beneficiary.birthday
                })
            }

            insertTableRapidoc();

            const uuid = response.data.beneficiary.uuid;
            const retorno = await axios.delete(`https://api.rapidoc.tech/tema/api/beneficiaries/${uuid}`, {
                headers: {
                    'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
                    'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
                    'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
                }
            });

            if (retorno.data.success === true) {
                 const inativar = await Clientes.update({
                situacao: "inativo",
            }, {
                where: {
                    nu_documento: cpf,
                }
            });
            
                res.json(retorno.data)
            } else {
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
routerApi.put('/beneficiaries/reactivate/:cpf', auth, async (req, res) => {
    const cpfinformed = req.params.cpf;

    const uuidGet = await Rapidoc.findAll({
        where: {
            cpf: cpfinformed
        }
    })


    if (uuidGet.length >= 1) {
        console.log(uuidGet.length)
        const uuid = uuidGet[0].uuid;
        const retorno = await axios.put(`https://api.rapidoc.tech/tema/api/beneficiaries/${uuid}/reactivate`, "data", {
            headers: {
                'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
                'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });

        if (retorno.data.success === true) {
             const reativar = await Clientes.update({
                situacao: "ativo",
            }, {
                where: {
                    nu_documento: cpfinformed,
                }
            });
            res.json(retorno.data)
        } else {
            res.json(retorno.data)
        }
    } else {
        res.json({ success: false, message: "usuario não encontrado" });
    }



});

///ativar vida manualmente via painel oimed
routerApi.post('/beneficiaries/activate/:cpf', auth, async (req, res) => {
    const cpf = req.params.cpf;
    try {

        //buscar dados pelo cpf na tabela de clientes
        const cliente = await Clientes.findAll({
            where: { nu_documento: cpf }
        });

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
                "paymentType": cliente[0].paymentType,
                "serviceType": cliente[0].serviceType,
                "holder": "",
                "general": ""
            }
        ];






        const dataArr = JSON.parse(cliente[0].beneficiarios);

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

        const response = await axios.post(`https://api.rapidoc.tech/tema/api/beneficiaries`, arrBD, {
            headers: {
                'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
                'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });



        if (response.data.success == true) {
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
            
            //alterar status
             const ativar = await Clientes.update({
                situacao: "ativo",
            }, {
                where: {
                    nu_documento: cpf,
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
        res.status(400).json(err);
        console.log(err.data)
    }
});

//consultar por cpf na rapidoc
routerApi.get('/consulta/oimed/:cpf', auth, async (req, res) => {
    const response = await axios.get(`https://api.rapidoc.tech/tema/api/beneficiaries/${req.params.cpf}`, {
        headers: {
            'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
            'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
            'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
        }
    });


    res.status(200);
    res.json(response.data);
})

///ativação de dependentes
routerApi.post('/ativacao/te', async (req, res) => {
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

        const response = await axios.post(`https://api.rapidoc.tech/tema/api/beneficiaries`, arrBD, {
            headers: {
                'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
                'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
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

module.exports = routerApi;