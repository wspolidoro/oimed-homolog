require('dotenv').config();

const axios = require('axios');
const dormir = require('../../functions/crud');
const Sleeping = require('../../schema/tb_sleeping');

async function wakeUp(cpf) {
    const resultado = await dormir.update(cpf);

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

    return resultado;

}

async function sleep(cpf) {
    const sleepingVerify = await Sleeping.findOne({
        where: {
            idVida: cpf
        },
        raw: true
    });

    if (sleepingVerify) {
        console.log("Cliente já está dormindo.");
        return sleepingVerify;
    }

    return null;
}

module.exports = {
    sleep,
    wakeUp
};