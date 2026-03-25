const axios = require('axios');

async function lerBeneficiario(cpf) {
    try {
        const response = await axios.get(`${process.env.API_URL}/beneficiaries/${cpf}`, {
            headers: {
                'clientId': process.env.CLIENT_ID,
                'Authorization': process.env.AUTHORIZATION,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });

        if (response.data.success) {
            return response.data.beneficiary;
        }

        return "não encontrado"
    } catch (err) {
        console.log(err)
    }


}

async function lerAgendamentoPorId(uuid) {

    console.log(uuid)


    try {
        const response = await axios.get(`${process.env.API_URL}/appointments`, {
            headers: {
                'clientId': process.env.CLIENT_ID,
                'Authorization': process.env.AUTHORIZATION,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });
        console.log(response.data)
        if (response.data.success) {
            return response
        }

        return "não encontrado"
    } catch (err) {
        console.log(err)
    }


}

module.exports = {
    lerBeneficiario,
    lerAgendamentoPorId
}