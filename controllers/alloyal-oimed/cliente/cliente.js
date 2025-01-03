//#region 
//Dados API SANDBOX:
// Painel Administrativo: https://dashboard-hmg.lecupon.com
// urlbase: https://api-hmg.lecupon.com
// emai admin: api.poupeaqui@lecupon.com
// password admin: 12345678
// business_id: 36
// API Key: poupe-aqui
// API Secret: 4da827b5df0982ff55ede58d58d2d3306491bb2e3a7ca1e2a9767fd797eebdb7eab186e4fdc7b31ad4c2873928f47ec61306cd7d639a3061ab081efcaefa1c8fe985c90bec3571ce45d1252e2785f28f119ce86a2e89b1b04e35f5d0490f3cdeefc2c0e6

// Dados API:
// Painel Administrativo: https://dashboard.lecupon.com
// urlbase: https://api.lecupon.com
// email admin: api.poupeaqui@lecupon.com
// password admin: 12345678
// business_id: 1113
// Api-Key: poupe-aqui
// Api-Secret: 587c94cef1553a7b91bb79f63d724e609aa8c84101831502ccbae5c4f90c19cb83dc95a0afd1d19be976042abe55ae690f4631b0ab5843b73a6860f70e1a4677e9dec6386d18d7e209177c3c59f24d7f19fa730231ec20f53244c81f006a1801bba340e7
//#endregion
const axios = require('axios')
const { AutenticaAlloyal } = require('../autenticacao/autenticacao');


const apiKey = 'poupe-aqui'
const businessIdSandbox = '36'
const apiSecretSandbox = '4da827b5df0982ff55ede58d58d2d3306491bb2e3a7ca1e2a9767fd797eebdb7eab186e4fdc7b31ad4c2873928f47ec61306cd7d639a3061ab081efcaefa1c8fe985c90bec3571ce45d1252e2785f28f119ce86a2e89b1b04e35f5d0490f3cdeefc2c0e6'
const businessId = '1113'
const apiSecret = '587c94cef1553a7b91bb79f63d724e609aa8c84101831502ccbae5c4f90c19cb83dc95a0afd1d19be976042abe55ae690f4631b0ab5843b73a6860f70e1a4677e9dec6386d18d7e209177c3c59f24d7f19fa730231ec20f53244c81f006a1801bba340e7'


async function CriarUsuarioAlloyal(cliente) {
    // 1. Obter o token de autenticação
    const autenticacao = await AutenticaAlloyal();
  
    if (!autenticacao) {
      console.error('Falha ao obter token e email de autenticação!');
      return;
    }

    const {token, email} = autenticacao;

    const userPassword = cliente.nu_documento.slice(0, 6);

  
    // 2. Inserir o token nos headers da requisição
    const options = {
      method: 'POST',
      url: `https://api.lecupon.com/client/v2/businesses/${businessId}/users`,
      headers: {
        accept: 'application/json',
        'X-ClientEmployee-Token': token,
        'X-ClientEmployee-Email': email,
        'content-type': 'application/json'
      },
      data: {
        name: cliente.nm_cliente,
        cpf: cliente.nu_documento,
        email: cliente.email,
        cellphone: cliente.telefone,
        password: userPassword 
      }
    };
  
    // 3. Realizar a requisição para criar o usuário
    try {
        const response = await axios.request(options);
        console.log('Usuário criado ou reativado com sucesso na Alloyal:', response.data);
        return response.data;
      } catch (error) {
        console.error('Erro ao criar ou reativar usuário na Alloyal:', error.message);
        throw error;
      }
  }
  

async function InativaUsuarioAlloyal(cpf) {
 /* const autenticacao = await AutenticaAlloyal();
  
  if (!autenticacao) {
    console.error('Falha ao obter token e email de autenticação!');
    return;
  }

  const {token, email} = autenticacao;


  const options = {
    method: 'DELETE',
    url: `https://api.lecupon.com/client/v2/businesses/${businessId}/authorized_users/${cpf}`,
    headers: {
      accept: 'application/json',
      'X-ClientEmployee-Token': token,
      'X-ClientEmployee-Email': email
    }
  };

  try {
    const response = await axios.request(options);
    console.log('Usuário inativado com sucesso na Alloyal:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro ao inativar usuário na Alloyal:', error.message);
    throw error;
  }*/
}

async function AtivaUsuarioAlloyal(cpf) {
  const autenticacao = await AutenticaAlloyal();
  
  if (!autenticacao) {
    console.error('Falha ao obter token e email de autenticação!');
    return;
  }

  const {token, email} = autenticacao;

  const options = {
    method: 'PATCH',
    url: `https://api.lecupon.com/client/v2/businesses/${businessId}/authorized_users/${cpf}`,
    headers: {
      accept: 'application/json',
      'X-ClientEmployee-Token': token,
      'X-ClientEmployee-Email': email
    },
    data: {active: 'true'}
  };

  try {
    const response = await axios.request(options);
    console.log('Usuário ativado com sucesso na Alloyal:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro ao inativar usuário na Alloyal:', error.message);
    throw error;
  }

}

module.exports = {CriarUsuarioAlloyal, InativaUsuarioAlloyal, AtivaUsuarioAlloyal}