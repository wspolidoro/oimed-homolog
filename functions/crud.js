require('dotenv').config();

const axios = require('axios');

module.exports = {
    create: async (data) => {
        try {
            const response = await fetch(`${API_URL}/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            return await response.json();
        } catch (error) {
            console.error('Error creating item:', error);
            throw error;
        }
    },

    read: async (id) => {
        try {
            const response = await fetch(`${API_URL}/items/${id}`);
            return await response.json();
        } catch (error) {
            console.error('Error reading item:', error);
            throw error;
        }
    },

    update: async (id) => {
        const uuid = id;

        try {

            const retorno = await axios.put(`${process.env.API_URL}/beneficiaries/${uuid}/reactivate`, "data", {
                headers: {
                    'clientId': process.env.CLIENT_ID,
                    'Authorization': process.env.AUTHORIZATION,
                    'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
                }
            });

            return retorno.data;

            if (retorno.data.success === true) {
                //res.json(retorno.data)
            } else {
                //res.json(retorno.data)
            }
        } catch (err) {
            console.log("caminho do erro: Routes.js linha 914 reativação")
            //console.log("erro do reactivate: ", err)
        }
    },

    delete: async (id) => {
        const cpf = id;
        console.log(id, `${process.env.API_URL}/beneficiaries/${id}`)

        try {
            /*   const response = await axios.get(`${process.env.API_URL}/beneficiaries/${cpf}`, {
                  headers: {
                      'clientId': process.env.CLIENT_ID,
                      'Authorization': process.env.AUTHORIZATION,
                      'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
                  }
              });
  
  
              if (response.data.success == false) {
                  console.log(response.data)
              } else {
   */

            try {
               const uuid = await axios.get(`${process.env.API_URL}/beneficiaries/${id}`, {
                    headers: {
                        'clientId': process.env.CLIENT_ID,
                        'Authorization': process.env.AUTHORIZATION,
                        'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
                    }
                }); 

//uuid.data.beneficiary.uuid
                //const uuid = response.data.beneficiary.uuid;
                const retorno = await axios.delete(`${process.env.API_URL}/beneficiaries/${uuid.data.beneficiary.uuid}`, {
                    headers: {
                        'clientId': process.env.CLIENT_ID,
                        'Authorization': process.env.AUTHORIZATION,
                        'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
                    }
                });

                console.log("retorno do delete", retorno.data)
                return retorno.data;
                if (retorno.data.success === true) {
                    //res.json(retorno.data)
                } else {
                    //res.json(retorno.data)
                }
            } catch (err) {
                console.log("testando", err.response.data)
                return 403;
            }
            //}
            /*  */
        } catch (err) {

            console.log("caminho do erro: crud.js linha 103", err.message, `${process.env.API_URL}/beneficiaries/${id}`)
        }
    },
};