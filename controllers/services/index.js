require('dotenv').config();
const axios = require('axios');

module.exports = {
    buscarClienteService: async (cpf) => {
        const response = await axios.get(`${process.env.API_URL}/beneficiaries/${cpf}`, {
            headers: {
                'clientId': process.env.CLIENT_ID,
                'Authorization': process.env.AUTHORIZATION,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });

        return response.data;
    }
}