const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const port = process.env.PORT || 3035;
const rout = require('./routs/Routes');
const routerApi = require('./api/api');
const routerSandbox = require('./api/sandbox');

//debbug
const sendMailError = require('./routs/sendMailer.js');

//docs
const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('./swagger.json');

app.use('/api/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(cors());

app.use(bodyParser.json());
// Express modules / packages 

app.use(bodyParser.urlencoded({ extended: true }));
// Express modules / packages 

app.use('/api/', rout);

app.get('/mailerr', async (req, res) => {

    let sending = await sendMailError(req.query.id, "Vida não cadastrada na RD");
    if (sending) {
        res.json({ success: true, message: "Email enviado!" })
    }


});

app.use('/api', routerApi);
app.use('/sandbox', routerSandbox);

const dormir = require('./functions/crud');
const Sleeping = require('./schema/tb_sleeping');
const Clientes = require('./schema/tb_clientes.js');
require('dotenv').config();
const iniciar = require('./functions/massInactivate/processar.js')

//LIBS
const { Op, Sequelize, literal } = require('sequelize');

const axios = require('axios');

/* async function testConnection() {
    const testeClient = await Clientes.findAll({
        where: {
            nu_documento: '79082278057'
        },
        raw: true,
        include: [{
            model: Sleeping,
            required: false // true = INNER JOIN / false = LEFT JOIN
        }]
    });


    console.log("testeClient: ", testeClient);
}

testConnection(); */


async function fallAsleep(cpf, uuid) {
    const resultado = await dormir.delete(uuid);

    try {
        if (!resultado) {
            console.log("erro: ", resultado);
            return;
        }

        Sleeping.create({
            idVida: cpf,
            uuid: resultado.beneficiary.uuid
        }).then((result) => {
            console.log("Entrou no sleeping: ", result.dataValues)
        }).catch((error) => {
            console.error(error.original.sqlMessage)
        });
    } catch (err) {
        console.log("erro ao inativar: ", err.message)
    }


}

//fallAsleep("20355942003");

async function wakeUp(cpf) {
    const resultado = await dormir.update(cpf);
    console.log("resultado wake up: ", resultado)

    if (!resultado.success) {
        console.log("erro: ", resultado);
        return;
    }

    Sleeping.destroy({
        where: {
            uuid: resultado.beneficiary.uuid
        }
    }).then((result) => {
        console.log("Saiu de sleeping: ", result)
    }).catch((error) => {
        console.error(error)
    });

}

//wakeUp("3aa63d54-bdfc-44b8-b6b7-ad683ed12ded");

app.put('/api/cliente/toggleSleeping/:uuid', async (req, res) => {
    const id = req.params.uuid;

    const sleepingVerify = await Sleeping.findOne({
        where: {
            idVida: id
        },
        raw: true
    });

    if (sleepingVerify) {
        wakeUp(sleepingVerify.uuid);
        res.status(200).json({ success: true, message: "Operação realizada com sucesso!" });
    }
});

async function massInactivation() {
    const clientes = await Clientes.findAll({
        where: {
            [Op.and]: [
                { situacao: 'ativo' },
                //{ uuid: "" }
            ]
            //situacao: 'ativo'
        },
        raw: true,
        attributes: ['nu_documento', 'situacao', 'uuid'],
        include: [{
            model: Sleeping,
            required: false // true = INNER JOIN / false = LEFT JOIN
        }]
    });


    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


    for (let i = 0; i < clientes.length; i++) {

        const sleepData = clientes[i]["oi_sleeping.uuid"];
        console.log(sleepData)

        if (!sleepData) {
            console.log(`Ignorando ${i + 1} — sem uuid`);
            continue; // Pula para o próximo
        }

        const cpf = clientes[i].nu_documento;
        const uuid = sleepData.uuid;

        console.log(`Inativando ${i + 1} de ${clientes.length} — CPF: ${cpf}`);

        await fallAsleep(cpf, uuid);
        await delay(5000);
    }


    return;


    //console.log("Total de clientes: ", clientes.length);

    const cpfsSleeping = await Sleeping.findAll({
        attributes: ["idVida"],
        raw: true
    });

    const listaSleeping = new Set(cpfsSleeping.map(x => x.idVida));




    const response = await axios.get(`${process.env.API_URL}/beneficiaries`, {
        headers: {
            'clientId': process.env.CLIENT_ID,
            'Authorization': process.env.AUTHORIZATION,
            'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
        }
    });

    let listaVidasAtivas = response.data.beneficiaries;

    //iniciar(clientes, listaSleeping, listaVidasAtivas);

    //console.log(listaVidasAtivas.length, clientes.length)





    async function ativar(uuid) {
        try {
            const retorno = await axios.put(
                `${process.env.API_URL}/beneficiaries/${uuid}/reactivate`,
                "data",
                {
                    headers: {
                        'clientId': process.env.CLIENT_ID,
                        'Authorization': process.env.AUTHORIZATION,
                        'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
                    }
                }
            );

            console.log("Ativado:", retorno.data.success);
            return retorno.data;

        } catch (err) {
            console.log("Erro ao reativar:", err.message);
        }
    }

    async function iniciar(clientes) {

        for (let i = 0; i < clientes.length; i++) {



            try {
                const cpf = clientes[i].nu_documento;
                console.log(`🔄 Ativando ${i + 1}/${clientes.length} — CPF: ${cpf}`);
                const response = await axios.get(
                    `${process.env.API_URL}/beneficiaries/${cpf}`,
                    {
                        headers: {
                            'clientId': process.env.CLIENT_ID,
                            'Authorization': process.env.AUTHORIZATION,
                            'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
                        }
                    }
                );
                console.log("UUID:", response.data);
                if (response.data.success) {
                    console.log("UUID:", response.data.beneficiary.uuid);

                    await Clientes.update({ uuid: response.data.beneficiary.uuid }, {
                        where: {

                            nu_documento: cpf,

                        }
                    }).then(res => {
                        console.log(res)
                    }).catch(err => {
                        console.error(err)
                    })

                    //await ativar(response.data.beneficiary.uuid);

                    // 🔥 Só depois que GET+PUT finalizam → Aguarda 2s

                }

            } catch (err) {
                console.log("Erro ao consultar CPF:", err.message);
            }
            await delay(5000);
        }

        console.log("\n🏁 FINALIZADO");
    }

    //iniciar(clientes);



}

//massInactivation()

app.listen(port, () => { // Listen on port 3000 
    console.log(`Listening! in port: ${port}`); // Log when listen success 
});

