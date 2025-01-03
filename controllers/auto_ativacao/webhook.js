function atualizarEstado(param) {
    fetch(`https://apioimed.z4you.com.br/franqueado/cliente/status`,
        {
            method: "PUT",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "id": param, "situacao": "ativo" })
        })
        .then((x) => x.json())
        .then((res) => {
        console.log(res)
        });
};


function alterarParaAtivo(client) {
    fetch(`https://apioimed.z4you.com.br/beneficiaries/create/${client}`,
  {
      method: "POST",
      headers: { 'Content-Type': 'application/json' }
  })
  .then((x) => x.json())
  .then((res) => {
      
      console.log("novo fetch: ", res);
      atualizarEstado(client);
  });
};

function webhookActivate(body, token, res) {
    console.log("kleidsom", token);
    const tokenSandBox = '$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAwODM0MjE6OiRhYWNoXzVmNzE0ZTM5LTI5NjUtNGY1MC04NjRlLTkyNGM5N2E1ZTVjMg==';
    const tokenProd = '$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDA0NTA1NTM6OiRhYWNoXzJkYjI5MjQ5LWU2ODEtNDcwNC1hNzAyLWU4NGRhZDA4NzRiNg==';

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

    res.json({success: true, message: "ok"});
        
    } else {
        res.json({success: true, message: "ok"});
    }
};



module.exports = { webhookActivate };
