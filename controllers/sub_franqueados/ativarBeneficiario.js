require('dotenv').config();
const axios = require('axios');
const SubClientes = require('../../schema/tb_sub_clientes.js');
const Franqueado = require('../../schema/tb_franqueado.js');
const { sendMailError, mailerNewCadastro } = require('../../routs/sendMailer.js');

function serviceVerification(serviceType) {
    if (serviceType === 'GS' || serviceType === 'GSP') {
        return 'G';
    } else {
        return serviceType;
    }
}

async function ativarBeneficiarioSubpainel(cpf, body) {
    if (body == 1) {
        const myDate = body.birthday;
        console.log(body);

        const dia = myDate.substr(0, 2);
        const mes = myDate.substr(2, 2);
        const ano = myDate.substr(4, 4);

        const dataVerify = /\//.test(myDate);

        const modifieData1 = () => {
            const dataSplit = myDate.split('/');
            return `${dataSplit[2]}-${dataSplit[1]}-${dataSplit[0]}`;
        };

        const modifieData2 = `${ano}-${mes}-${dia}`;
        const birthdayFormat = dataVerify ? modifieData1() : modifieData2;

        const arrBD = [
            {
                "name": body.name,
                "cpf": body.cpf,
                "birthday": birthdayFormat,
                "phone": body.phone,
                "email": body.email,
                "zipCode": body.zipCode,
                "address": body.address,
                "city": body.city,
                "state": body.state,
                "paymentType": "S",
                "serviceType": "G",
                "holder": body.holder,
                "general": ""
            }
        ];

        const response = await axios.post(`https://api.rapidoc.tech/tema/api/beneficiaries`, arrBD, {
            headers: {
                'clientId': process.env.CLIENT_ID || '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
                'Authorization': process.env.AUTHORIZATION,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });

        if (response.data && response.data.success == true) {
            console.log("criado: ", response.data);
            return { success: true, data: response.data };
        } else {
            console.log("erro ao criar indie: ", response.data);
            return { success: false, data: response.data };
        }
    }

    const cliente = await SubClientes.findAll({
        where: { nu_documento: cpf }
    });

    if (!cliente || cliente.length < 1) {
        console.log("cliente não encontrado na base de dados");
        return { success: false, message: "cliente não encontrado na base de dados" };
    }

    const myDate = cliente[0].birthday;
    const dia = myDate.substr(0, 2);
    const mes = myDate.substr(2, 2);
    const ano = myDate.substr(4, 4);

    const dataVerify = /\//.test(myDate);

    const modifieData1 = () => {
        const dataSplit = myDate.split('/');
        const format = `${dataSplit[2]}-${dataSplit[1]}-${dataSplit[0]}`;
        return format.replace(/\s/g, '');
    };

    const modifieData2 = `${ano}-${mes}-${dia}`;
    const birthdayFormat = dataVerify ? modifieData1() : modifieData2;

    console.log(modifieData2, birthdayFormat);

    const arrBD = [
        {
            "name": cliente[0].nm_cliente,
            "cpf": cliente[0].nu_documento,
            "birthday": birthdayFormat,
            "phone": cliente[0].telefone,
            "email": cliente[0].email,
            "zipCode": cliente[0].zip_code,
            "address": "rua do teste, 01",
            "city": cliente[0].city,
            "state": cliente[0].state && cliente[0].state.length <= 2 ? cliente[0].state : (cliente[0].state ? cliente[0].state.substr(cliente[0].state.length - 3, 2) : ''),
            "paymentType": cliente[0].paymentType,
            "serviceType": serviceVerification(cliente[0].serviceType),
            "holder": cliente[0].cpf_titular === 'titular' ? "" : cliente[0].cpf_titular,
            "general": cliente[0].id_franqueado
        }
    ];

    let dataArr = [];
    try {
        dataArr = JSON.parse(cliente[0].beneficiarios || '[]');
    } catch (e) {
        dataArr = [];
    }

    if (dataArr && dataArr.length > 0) {
        if (dataArr[0] && dataArr[0].nu_documento1 != null) {
            console.log("testando");
            const data = dataArr[0].birthday1 ? dataArr[0].birthday1.split('/') : null;
            const birthdayFormat1 = data ? data : null;
            console.log("teste da data", dataArr[0].nu_documento1);

            const dep1 = {
                "name": dataArr[0].nm_cliente1,
                "cpf": dataArr[0].nu_documento1,
                "birthday": birthdayFormat1 ? `${birthdayFormat1[2]}-${birthdayFormat1[1]}-${birthdayFormat1[0]}` : null,
                "phone": dataArr[0].telefone1,
                "email": dataArr[0].email1,
                "zipCode": dataArr[0].zipCode1,
                "address": dataArr[0].address1,
                "city": dataArr[0].city1,
                "state": dataArr[0].state1 && dataArr[0].state1.length <= 2 ? dataArr[0].state1 : (dataArr[0].state1 ? dataArr[0].state1.substr(dataArr[0].state1.length - 3, 2) : ''),
                "holder": cliente[0].nu_documento
            };
            arrBD.push(dep1);
        } else if (dataArr[1] && dataArr[1].nu_documento2 != null) {
            const data = dataArr[1].birthday1 ? dataArr[1].birthday1.split('/') : null;
            const birthdayFormat2 = data ? data : null;

            const dep2 = {
                "name": dataArr[1].nm_cliente2,
                "cpf": dataArr[1].nu_documento2,
                "birthday": birthdayFormat2 ? `${birthdayFormat2[2]}-${birthdayFormat2[1]}-${birthdayFormat2[0]}` : null,
                "phone": dataArr[1].telefone2,
                "email": dataArr[1].email2,
                "zipCode": dataArr[1].zipCode2,
                "address": dataArr[1].address2,
                "city": dataArr[1].city2,
                "state": dataArr[0] && dataArr[0].state2 && dataArr[0].state2.length <= 2 ? dataArr[0].state2 : (dataArr[0] && dataArr[0].state2 ? dataArr[0].state2.substr(dataArr[0].state2.length - 3, 2) : ''),
                "holder": cliente[0].nu_documento
            };
            arrBD.push(dep2);
        } else if (dataArr[2] && dataArr[2].nu_documento3 != null) {
            const data = dataArr[2].birthday1 ? dataArr[2].birthday1.split('/') : null;
            const birthdayFormat3 = data ? data : null;

            const dep3 = {
                "name": dataArr[2].nm_cliente3,
                "cpf": dataArr[2].nu_documento3,
                "birthday": birthdayFormat3 ? `${birthdayFormat3[2]}-${birthdayFormat3[1]}-${birthdayFormat3[0]}` : null,
                "phone": dataArr[2].telefone3,
                "email": dataArr[2].email3,
                "zipCode": dataArr[2].zipCode3,
                "address": dataArr[2].address3,
                "city": dataArr[2].city3,
                "state": dataArr[0] && dataArr[0].state3 && dataArr[0].state3.length <= 2 ? dataArr[0].state3 : (dataArr[0] && dataArr[0].state3 ? dataArr[0].state3.substr(dataArr[0].state3.length - 3, 2) : ''),
                "holder": cliente[0].nu_documento
            };
            arrBD.push(dep3);
        }
    }

    console.log("debug: ", dataArr);
    console.log("origewm: ", arrBD);

    try {
        const response = await axios.post(`https://api.rapidoc.tech/tema/api/beneficiaries`, arrBD, {
            headers: {
                'clientId': process.env.CLIENT_ID || '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
                'Authorization': process.env.AUTHORIZATION,
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
            }
        });

        console.log("resposta: ", response.data);

        if (response.data && response.data.success == true) {
            await SubClientes.update({
                dtAtivacao: new Date()
            }, {
                where: { nu_documento: cpf }
            });

            const dataFranqueado = await Franqueado.findAll({
                where: {
                    id: cliente[0].dataValues.id_franqueado
                }
            });

            if (dataFranqueado && dataFranqueado.length > 0) {
                await mailerNewCadastro(dataFranqueado[0].dataValues, cliente[0].dataValues.email);
            }

            await sendMailError(arrBD, "Vida cadastrada na Central principal", response.data, cliente[0].id_franqueado, "CONCLUIDO");
            return { success: true, data: response.data };
        } else {
            console.log("erro ao criar: ", response.data);
            await sendMailError(arrBD, "Vida não cadastrada na Central principal", response.data, cliente[0].id_franqueado, "PENDENTE");
            return { success: false, data: response.data };
        }
    } catch (err) {
        console.log("caminho do erro ao ativar beneficiario subpainel: ", err.message);
        await sendMailError(arrBD, "Vida não cadastrada na Central principal", err.response ? err.response.data : err.message, cliente[0].id_franqueado, "PENDENTE");
        return { success: false, error: err.message, data: err.response ? err.response.data : null };
    }
}

module.exports = {
    ativarBeneficiarioSubpainel
};
