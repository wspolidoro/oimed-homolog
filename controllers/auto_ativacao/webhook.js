const tokenSandBox = '$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjEwM2NlODFiLTM0NWEtNGE4NS1iZjYxLTRkZWU4MWI4NTUwMjo6JGFhY2hfMGM0M2ZhZjEtOGQ3ZS00NDMwLWFhNzQtMjhjZTgzNTZmN2Fk';
const tokenProd = '$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDA0NTA1NTM6OiRhYWNoXzJkYjI5MjQ5LWU2ODEtNDcwNC1hNzAyLWU4NGRhZDA4NzRiNg==';
//const urlApi = "http://localhost:3035/api";
const urlApi = "https://parceiro.painelw.com.br/api";


function atualizarEstado(param, status) {
    fetch(`${urlApi}/franqueado/cliente/status`,
        {
            method: "PUT",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "id": param, "situacao": status })
        })
        .then((x) => x.json())
        .then((res) => {
            console.log(res)
        });
};


function alterarParaAtivo(client) {
    fetch(`${urlApi}/beneficiaries/create/${client}`,
        {
            method: "POST",
            headers: { 'Content-Type': 'application/json' }
        })
        .then((x) => x.json())
        .then((res) => {

            console.log("novo fetch ativar: ", res);
            atualizarEstado(client, "ativo");

            if (res.message === 'CPF já utilizado; ') {
                alterarParaReativo(client)
            }
        }).catch(err => {
            console.log("erro ao ativar: ", err)
        });
};

function alterarParaInativo(client) {
    fetch(`${urlApi}/beneficiaries/${client}`,
        {
            method: "DELETE",
            headers: { 'Content-Type': 'application/json' }
        })
        .then((x) => x.json())
        .then((res) => {

            console.log("novo fetch inativar: ", res);
            atualizarEstado(client, "inativo");

        }).catch(err => {
            console.log("erro ao inativar: ", err)
        });
};

function alterarParaReativo(client) {
    fetch(`${urlApi}/beneficiaries/reactivate/${client}`,
        {
            method: "PUT",
            headers: { 'Content-Type': 'application/json' }
        })
        .then((x) => x.json())
        .then((res) => {

            console.log("novo fetch reativar: ", res);
            atualizarEstado(client, "ativo");
        }).catch(err => {
            console.log("erro ao reativar: ", err)
        });
};



function webhookActivate(body, token, res) {
    console.log("kleidsom", token);
    //const tokenSandBox = '$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAwODM0MjE6OiRhYWNoXzVmNzE0ZTM5LTI5NjUtNGY1MC04NjRlLTkyNGM5N2E1ZTVjMg==';
    //const tokenProd = '$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDA0NTA1NTM6OiRhYWNoXzJkYjI5MjQ5LWU2ODEtNDcwNC1hNzAyLWU4NGRhZDA4NzRiNg==';

    if (body.event === 'PAYMENT_CONFIRMED' || body.event === 'PAYMENT_RECEIVED') {
        const urlSandBox = `https://sandbox.asaas.com/api/v3/customers/${body.payment.customer}`;
        const urlProd = `https://api.asaas.com/v3/customers/${body.payment.customer}`;
        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                access_token: token
            }
        };


        fetch(urlProd, options)
            .then(res => res.json())
            .then(json => {
                console.log(json.cpfCnpj);
                alterarParaAtivo(json.cpfCnpj);

            })
            .catch(err => console.error(err));

        res.json({ success: true, message: "ok" });

    } else {
        res.json({ success: true, message: "ok" });
    }
};

function webhookInactivate(body, token, res) {
    if (body.event === 'PAYMENT_OVERDUE') {
        const urlSandBox = `https://sandbox.asaas.com/api/v3/customers/${body.payment.customer}`;
        const urlProd = `https://api.asaas.com/v3/customers/${body.payment.customer}`;
        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                access_token: token
            }
        };


        fetch(urlProd, options)
            .then(res => res.json())
            .then(json => {
                console.log(json.cpfCnpj);
                alterarParaInativo(json.cpfCnpj);

            })
            .catch(err => console.error(err));

        res.json({ success: true, message: "ok" });

    } else {
        res.json({ success: true, message: "ok" });
    }
};


module.exports = { webhookActivate, webhookInactivate };
