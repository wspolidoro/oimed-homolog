const axios = require('axios');


async function AutenticaAlloyal(){
  const options = {
    method: 'POST',
    url: 'https://api.lecupon.com/client/v2/sign_in',
    headers: {accept: 'application/json', 'content-type': 'application/json'},
    data: {email: 'api.poupeaqui@lecupon.com', password: '12345678'}
  };

  try {
    const response = await axios.request(options);
    console.log(response.data);
    const token = response.data.auth_token;
    console.log('Esse é o token:', token);
    return { token, email: options.data.email };
  } catch (error) {
    console.error(error);
    return null; 
  }
}
//AutenticaAlloyal()

//teste para ver se está retornando o token direitinho
//AutenticaAlloyal();


// ********************** UTILIZANDO SDK ************************************
// import sdk from '@api/lecupon';

// async function autenticaLecupon() {
//   const email = 'api.poupeaqui@lecupon.com';
//   const password = '12345678';

//   try {
//     const { data } = await sdk.tokenAutenticaO({ email, password });
//     return data.token;
//   } catch (err) {
//     console.error('Erro ao autenticar na Lecupon:', err.message);
//     throw err;
//   }
// }

// // Exemplo de uso
// autenticaLecupon()
//   .then(token => console.log('Token obtido:', token))
//   .catch(err => console.error('Erro:', err.message));
//********************************************************** */

module.exports = {AutenticaAlloyal}
