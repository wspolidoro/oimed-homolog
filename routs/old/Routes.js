//CONFIGS
const express = require('express');
const router = express.Router();
//const database = require('../db');
const { sequelize, sandbox } = require('../db');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { faker } = require('@faker-js/faker');
const mailer = require('./sendMailer');

//SCHEMAS
const Franqueado = require('../schema/tb_franqueado');
const Clientes = require('../schema/tb_clientes');
const Rapidoc = require('../schema/tb_rapidoc');

//LIBS
const { Op, Sequelize } = require('sequelize');

const secretKey = "@rfxzsklc_s+bg7t+@f6^obve=f!swr1%0838lctalor92vi";

//middleware
router.use(function timelog(req, res, next) {
  console.log('Time: ', Date.now());
  next();
});

function privateAuth(req, res, next) {
  const authToken = req.headers['authorization'];

  if (authToken != undefined) {

    const bearer = authToken.split(' ');
    var token = bearer[1];

    jwt.verify(token, secretKey, (err, data) => {
      if (err) {
        res.status(401);
        res.json({ success: false, message: "Token inválido" })
      } else {
        req.token = token;
        req.loggerUser = { id: data.id, email: data.email };
        next();
      }
    });

  } else {
    res.status(401);
    res.json({ success: false, message: "Token inválido" });
  }
};

router.post('/auth', async (req, res) => {

  var { email, password } = req.body;
  console.log(email, password)
  
  
  try {
    if (email != undefined) {

    //var user = DB.users.find(u => u.email == email);

    const linkFranqueado = await Franqueado.findAll();

    //res.json(linkFranqueado);

    var user = linkFranqueado.find(u => u.email == email);

    //res.json(user);

    if (user != undefined) {
      if (user.password == password) {

        jwt.sign({ id: user.id, email: user.email }, secretKey, { expiresIn: '2h' }, (err, token) => {
          if (err) {
            res.status(400);
            res.json({ success: false, message: "Falha interna..." })
          } else {
            res.status(200);
            res.json({
              success: true,
              message: "usuario logado",
              token: token,
              perfil: user.perfil,
              id: user.id
            });
          }
        });
      } else {
        res.status(404);
        res.json({ success: false, message: "acesso invalido" });
      }
    } else {
      res.status(404);
      res.json({ success: false, message: "email não encontrado" });
    };

  } else {
    res.status(400);
    res.json({ success: false, message: "email invalido" })
  };
}catch(err) {
    res.json({"success": false, "message": err})
}
  
  
});

//rota principal
router.get('/', async (req, res) => {
  res.json({ message: 'funcionando', status: 200 });
});

//rota de testes para adicionar franqueados
router.post('/franqueado', async (req, res) => {
  try {
    await sequelize.sync();

    const newFranqueado = await Franqueado.create({
      nome: req.body.nome,
      cpf: req.body.cpf,
      telefone: req.body.telefone,
      email: req.body.email,
      password: faker.string.hexadecimal({ length: 12 }),
      total_clientes: '3',
      vendas: '0',
      dado_banc: req.body.nu_banco,
      dado_pix: req.body.chave_pix,
      site_venda: req.body.site_url,
      status: 'ativo',
      perfil: 'guest',
      products: req.body.products
    });

    //console.log(req.body) 

    res.json(newFranqueado);

  } catch (err) {
    return res.status(400).json(err)
  }

});

router.put('/franqueado/putproducts', async (req, res) => {
  try {
    await sequelize.sync();

    const newFranqueado = await Franqueado.update({
      products: req.body.products
    }, {
      where: {
        id: req.body.id,
      }

    });

    res.json(newFranqueado);

  } catch (err) {
    return res.status(400);
  }
});

//rota de testes para reservar clientes
router.post('/franqueado/clientes', async (req, res) => {
  try {
    await sequelize.sync();
    
    console.log(req.body);
    
    var cpfNumber = req.body.nu_documento;
    var numericCpfNumber = cpfNumber.replace(/\D/g, "");

   const newCliente = await Clientes.create({
      nm_cliente: req.body.nm_cliente,
      nu_documento: numericCpfNumber,
      birthday: req.body.birthday,
      telefone: req.body.telefone,
      email: req.body.email,
      zip_code: req.body.zip_code,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      dt_venda: "default",
      situacao: "Pendente",
      nu_parcelas: "default",
      vl_venda: "default",
      dt_cobranca: "default",
      dt_vencimento: "default",
      dt_pagamento: "default",
      par_atual: "default",
      paymentType: req.body.paymentType,
      serviceType: req.body.serviceType,
      link: req.body.link,
      beneficiarios: req.body.beneficiarios,
      id_franqueado: req.body.id_franqueado
    });


    res.json(newCliente);

  } catch (err) {
    return res.status(400).json(err)
  }

});

//rota de testes para reservar clientes
router.post('/franqueado/vendas', async (req, res) => {
    
    if(req.body.categoria != 'link.sucesso') {
        console.log("erro na transação");
        console.log(req.body);
    } else {
        
        const referencia = req.body.nu_referencia;
    
        const venda = await axios.get(`https://api.fpay.me/vendas?nu_referencia=${referencia}`, {
          headers: {
            'Content-Type': 'application/json',
            "Client-Code": "FC-747670",// 'FC-SB-15',
            "Client-key": "ef88121dbae3c2c1c7eaef044e568ff3"//'6ea297bc5e294666f6738e1d48fa63d2'
          }
        });
        console.log("nu_documento Válido: ", venda.data.data[0])
        if(venda) {
            console.log("nu_documento Válido: ", venda.data.data[0].nu_documento)
        } else {
            console.log("nu_documento Inválido: ", venda.data.data[0].nu_documento);
        }
    
        //res.send(venda.data.data[0].nu_documento);
        //console.log(venda.data.data[0].nu_documento);
        
        console.log(req.body)
     try {
        const response = await axios.get(`https://api.fpay.me/clientes?nu_documento=${venda.data.data[0].nu_documento}`, {
          headers: {
            'Content-Type': 'application/json',
            "Client-Code": "FC-747670",//'FC-SB-15',
            "Client-key": "ef88121dbae3c2c1c7eaef044e568ff3"//'6ea297bc5e294666f6738e1d48fa63d2'
          }
        });
        
          // Obtém a data atual
              const dataAtual = new Date();
    
              // Obtém o mês atual (valores de 0 a 11, onde 0 é janeiro e 11 é dezembro)
              const mesAtual = dataAtual.getMonth();
    
              // Filtra o objeto com base no mês atual
              const objetoDoMesAtual = venda.data.data[0].parcelas.filter((parcela) => {
                // Obtém a data da parcela
                const dataParcela = new Date(parcela.dt_vencimento);
    
                // Obtém o mês da parcela
                const mesParcela = dataParcela.getMonth();
    
                // Verifica se o mês da parcela é igual ao mês atual
                return mesParcela === mesAtual;
              });
              
              console.log("ver ess aqyui: ",objetoDoMesAtual)
    
              const cliente = await Clientes.update({
                nm_cliente: venda.data.data[0].nm_cliente,
                nu_documento: venda.data.data[0].nu_documento,
                email: response.data.data[0].ds_email,
                dt_venda: venda.data.data[0].dt_venda,
               // situacao: venda.data.data[0].situacao,
                nu_parcelas: venda.data.data[0].nu_parcelas,
                vl_venda: venda.data.data[0].vl_venda,
                dt_cobranca: objetoDoMesAtual && objetoDoMesAtual.dt_cobranca || "não informado",
                dt_vencimento: objetoDoMesAtual && objetoDoMesAtual.dt_vencimento || "não informado",
                dt_pagamento: objetoDoMesAtual && objetoDoMesAtual.dt_pagamento || "não informado",
                par_atual: objetoDoMesAtual && objetoDoMesAtual.situacao || "não informado"
              }, {
                where: {
                  nu_documento: venda.data.data[0].nu_documento,
                }
              });

        //console.log(venda.data.data[0].parcelas[0].dt_cobranca);

        ativarVida(res, venda.data.data[0].nu_documento)
        .then(async (result) => {
            if (result) {
                console.log("nand: ", venda.data.data[0])
                
             /* // Obtém a data atual
              const dataAtual = new Date();
    
              // Obtém o mês atual (valores de 0 a 11, onde 0 é janeiro e 11 é dezembro)
              const mesAtual = dataAtual.getMonth();
    
              // Filtra o objeto com base no mês atual
              const objetoDoMesAtual = venda.data.data[0].parcelas.filter((parcela) => {
                // Obtém a data da parcela
                const dataParcela = new Date(parcela.dt_vencimento);
    
                // Obtém o mês da parcela
                const mesParcela = dataParcela.getMonth();
    
                // Verifica se o mês da parcela é igual ao mês atual
                return mesParcela === mesAtual;
              });*/
    

              const cliente = await Clientes.update({
                /*nm_cliente: venda.data.data[0].nm_cliente,
                nu_documento: venda.data.data[0].nu_documento,
                email: response.data.data[0].ds_email,
                dt_venda: venda.data.data[0].dt_venda,*/
                situacao: "ATIVO"
                /*nu_parcelas: venda.data.data[0].nu_parcelas,
                vl_venda: venda.data.data[0].vl_venda,
                dt_cobranca: (objetoDoMesAtual[0].dt_cobranca) ? objetoDoMesAtual[0].dt_cobranca : "não informado",
                dt_vencimento: (objetoDoMesAtual[0].dt_vencimento) ? objetoDoMesAtual[0].dt_vencimento : "não informado",
                dt_pagamento: (objetoDoMesAtual[0].dt_pagamento) ? objetoDoMesAtual[0].dt_pagamento : "não informado",
                par_atual: (objetoDoMesAtual[0].situacao) ? objetoDoMesAtual[0].situacao : "não informado"*/
              }, {
                where: {
                  nu_documento: venda.data.data[0].nu_documento,
                }
              });
            };
            console.log("resultado da operação: ", result)
          })
          .catch((err) => {
            console.log(err)
          })

        } catch (err) {
            res.status(400);
            res.send(err);
            console.log(err);
        }  
    };
});

//buscar link do franqueado
router.get('/franqueado/link/:id', async (req, res) => {
  const linkFranqueado = await Franqueado.findAll({
    where: {
      id: req.params.id
    }
  });

  res.json(linkFranqueado[0].nome)
  /* res.json(linkFranqueado[0].link) */
});

//buscar cliente por franqueado
router.post('/franqueado/filter', async (req, res) => {
  try {
    const linkFranqueado = await Franqueado.findAll({
      where: {
        cpf: req.body.nu_documento
      }
    });

    const linkCliente = await Clientes.findAll({
      where: {
        id_franqueado: linkFranqueado[0].id
      }
    });

    res.json(linkCliente);
  }
  catch (err) {
    res.json({ success: false, message: "Franqueado não encotrado!" })
  }


});

//buscar cliente por status
router.post('/cliente/filter/status/:status', async (req, res) => {
  let statusParam = req.params.status;
  try {
    const situacaoAtual = await Clientes.findAll({
      where: {
        situacao: statusParam
      }
    });

    res.json(situacaoAtual);
  }
  catch (err) {
    res.json({ success: false, message: "Franqueado não encotrado!" })
  }


});

//buscar lista de franqueados
router.get('/franqueado/list', async (req, res) => {
  const linkFranqueado = await Franqueado.findAll();
    countClients();

  res.json(linkFranqueado);

});

//buscar franqueados unico
router.post('/franqueado/listunique', async (req, res) => {
  const linkFranqueado = await Franqueado.findAll({
    where: {
      cpf: req.body.cpf
    }
  });

  res.json(linkFranqueado);

});

//buscar lista de clientes
router.post('/franqueado/clientes/list', async (req, res) => {
  if (req.body.perfil == "guest") {
    const nmClientes = await Clientes.findAll({
      where: { id_franqueado: req.body.id }
    });

    res.send(nmClientes)
  } else {
    const Cliente = await Clientes.findAll();

    res.json(Cliente);
  }


});

//atualizar franqueados
router.get('/franqueado/update/:id', async (req, res) => {
  Franqueado.destroy({ where: { id: req.params.id } })
  res.json('deletado');
});

//buscar cliente por franqueado
router.get('/clientes/list', async (req, res) => {
  const nmClientes = await Clientes.findAll({
    where: { link: req.body.link }
  });

  res.send(nmClientes)

});

//buscar cliente
router.post('/clientes/seacrh/list', async (req, res) => {
  const nmClientes = await Clientes.findAll({
    where: { nu_documento: req.body.nu_documento }
  });

  if (nmClientes) {
    res.json(nmClientes)
  } else {
    res.json({ "success": false, "message": "usuário não encontrado.." });
  }


});

//atualizar dados dos dependentes
router.put('/cliente/dependente', async (req, res) => {
  try {
    const cliente = await Clientes.update({
      beneficiarios: JSON.stringify(req.body.dependenteObj),
    }, {
      where: {
        id: req.body.id
      }
    });

    res.status(200).json(cliente);

  } catch (err) {
    res.status(400).json(err);
  }

});

//apagar franqueado
router.delete('/franqueado/:id', async (req, res) => {
  Franqueado.destroy({ where: { id: req.params.id } })
  res.json('deletado');
});

//apagar cliente
router.delete('/franqueado/cliente/:id', async (req, res) => {
  Clientes.destroy({ where: { id: req.params.id } })
  res.json('deletado');
});

//rota de testes para mudar situação do cliente
router.put('/franqueado/cliente/status', async (req, res) => {
  try {
    const cliente = await Clientes.update({
      situacao: req.body.situacao,
    }, {
      where: {
        id: req.body.id,
      }
    });

    res.json(cliente);
    console.log(req.body)

  } catch (err) {
    res.status(400).json(err);
    console.log(err)
  }

});


router.get('/testemail', async (req, res) => {
  /*   const envio = await mailer();
    res.send(envio); */
})

//gerar PDF inscrição
router.get('/pdf', async (req, response) => {

  const countMax = await Member.findAll({
    attributes: [[Sequelize.fn('max', Sequelize.col('id')), 'id']],
    raw: true,
  });
  const members = await Member.findAll({
    where: {
      id: countMax[0].id
    }
  });

  const client = await Client.findAll({
    where: {
      GYM_NAME: members[0].gym
    }
  });

  var obj = {
    'uuid': members[0].id.toString(),
    'nm_member': members[0].nm_member,
    'birthday': `${members[0].birthday_year}/${members[0].birthday_month}/${members[0].birthday_day}`,
    'genero': members[0].genero,
    'adress': members[0].adress_input,
    'phone': `(${members[0].phone01}) ${members[0].phone02}-${members[0].phone03}`,
    'email': members[0].email,
    'language': members[0].lang01,
    'plan': members[0].plans,
    'signature': members[0].signature,
    'entryDate': new Intl.DateTimeFormat('ja-JP').format(members[0].createdAt),
    'gymname': members[0].gym
  };

  ejs.renderFile('./views/email.ejs', obj, async (err, html) => {
    if (err) {
      console.log("erro!!!!!")
    } else {
      pdf.create(html, { "orientation": "landscape", format: 'a4' })
        .toFile(`./historico/Ficha de Inscricao.pdf`, async (err, res) => {
          if (err) {
            console.log('erro')
          } else {
            //response.send(res)
            try {
              let memberEmail = await mailer(`./historico/Ficha de Inscricao.pdf`, obj.email, obj.nm_member, obj.language, client[0].LANGUAGE, client[0].EMAIL);
              response.json(memberEmail);
            } catch (err) { console.log(err) }
          }
        });
    }
  });

  /* response.json(obj); */

});



/*--------implementação rapidoc------------*/

//inativar vida
router.delete('/beneficiaries/:cpf', async (req, res) => {
  const cpf = req.params.cpf;

try {
      const response = await axios.get(`https://api.rapidoc.tech/tema/api/beneficiaries/${cpf}`, {
           headers: {
      'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
      'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
      'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
        }
     /*   headers: {
          'clientId': 'd13f4321-f78e-4261-b9d6-f741da923d72',
          'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M-VtcJUO5XiDH9ImsqUswxOXv3v9pmVh_6UsuDHoOmLUnmITAh248cplIpccmQDQHBXkp68aiw90JFZuTn3c45_HrWmGdpRxt8wIwxBHimXD8bt0IY2mU3BUSvjy4p36mEuZsINjfwOOib9CZQBljKcg9UbhbDQckUFvs-Q5MF6NKFqqLL360OzhdMtcENIhOZC4qKdgfLSR5xLPaJf6CZew6YiSeuS1jlzIBxgwB2VkI4CdrjyeaVoIewy-qldf4mGu6QC16GAOWnFAs4z6YxWaQ9j-dgoZSDNOiaaJ3363blck8T0wAXJmRsMz0TezOlXthrwY2l8McctMrlyTgeBA8Ny7tztH5CQEug78bul4HfAH5gtZ-xiUPJo_pYqm4fJ4udx5t8HShHGJMxAc81imX5mF7ZAWXSyPEeWGVZqCjK49Dh96VHlTRlQXfImHOQvMIIALTrDmT6J9XIp3v5DkXdc2CjC36q0UKnFeDSDoP08_KJlbWhbRiYgD1vIKEgx1RxyFGASVY1DtkYruytRtk9qow7Cpo95WPiCrqDDBN92rn6XcdO4_NlLPzysr9FsYwwVPSl5MDehtx8Kl2mJREH0Xv0GHeULKcMtp_UEvgeqMtD8LT5y7Nem01OZaMoVJUIYehlGwvZPE_6IqMaloSqO8UWix9SrN_z_bagA',
          'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
        }*/
        });
        

        if(response.data.success == false) {
            res.status(404);
            res.json(response.data.message);
        } else {
            async function insertTableRapidoc() {
            await sequelize.sync();
            const newRapidoc = await Rapidoc.create({
              nome: response.data.beneficiary.name,
              cpf: response.data.beneficiary.cpf,
              uuid: response.data.beneficiary.uuid,
              birthday: response.data.beneficiary.birthday
            })
          }
        
          insertTableRapidoc();


            try{
                  const uuid = response.data.beneficiary.uuid;
              const retorno = await axios.delete(`https://api.rapidoc.tech/tema/api/beneficiaries/${uuid}`, {
                headers: {
                  'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
                  'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
                  'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
                }
              });
               if (retorno.data.success === true) {
                res.json(retorno.data)
              } else {
                res.json(retorno.data)
              }
            }catch(err) {
                console.log("testando", err)
            }
        }
/*  */
    } catch (err) {
        res.status(500);
        res.json(err);
        console.log(err)
    }


});

//reativar vida
router.put('/beneficiaries/reactivate/:cpf', async (req, res) => {
    try{
        const cpfinformed = req.params.cpf;

  const uuidGet = await Rapidoc.findAll({
    where: {
      cpf: cpfinformed
    }
  })

  console.log(uuidGet)
  const uuid = uuidGet[0].uuid;
  const retorno = await axios.put(`https://api.rapidoc.tech/tema/api/beneficiaries/${uuid}/reactivate`, "data", {
    headers: {
      'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
      'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
      'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
    }
  });

  if (retorno.data.success === true) {
    res.json(retorno.data)
  } else {
    res.json(retorno.data)
  }
    }catch(err) {
        console.log("erro do reactivate: ", err)
    }
});

///ativar vida manualmente via painel oimed
router.post('/beneficiaries/create/:cpf', async (req, res) => {
  const cpf = req.params.cpf;
  try {

    //buscar dados pelo cpf na tabela de clientes
    const cliente = await Clientes.findAll({
      where: { nu_documento: cpf }
    });

    //configuracao da data
    const myDate = cliente[0].birthday;
    
    const dia = myDate.substr(0, 2);
    const mes = myDate.substr(2, 2);
    const ano = myDate.substr(4, 4);

    const dataVerify = /\//.test(myDate);
    
    var modifieData1 = () => {
        const dataSplit = myDate.split('/');
        const format = `${dataSplit[2]}-${dataSplit[1]}-${dataSplit[0]}`;
        
        return format;
    };
    
    var modifieData2 = `${ano}-${mes}-${dia}`;

    const birthdayFormat =  dataVerify ? modifieData1() : modifieData2; //formatar data para 0000-00-00

    //Array principal que vai para rapidoc
    const arrBD = [
      {
        "name": cliente[0].nm_cliente,
        "cpf": cliente[0].nu_documento,
        "birthday": birthdayFormat,
        "phone": cliente[0].telefone,
        "email": cliente[0].email,
        "zipCode": cliente[0].zip_code,
        "address": cliente[0].address,
        "city": cliente[0].city,
        "state": cliente[0].state,
        "paymentType": cliente[0].paymentType,
        "serviceType": cliente[0].serviceType,
        "holder": "",
        "general": ""
      }
    ];






    const dataArr = JSON.parse(cliente[0].beneficiarios);

    if (dataArr[0].nu_documento1 !== null) {
        const data = dataArr[0].birthday1.split('/');
      const birthdayFormat1 = data ? data : null;
      

      const dep1 = {
        "name": dataArr[0].nm_cliente1,
        "cpf": dataArr[0].nu_documento1,
        "birthday": `${birthdayFormat1[2]}-${birthdayFormat1[1]}-${birthdayFormat1[0]}`,
        "phone": dataArr[0].telefone1,
        "email": dataArr[0].email1,
        "zipCode": dataArr[0].zipCode1,
        "address": dataArr[0].address1,
        "city": dataArr[0].city1,
        "state": dataArr[0].state1
      }

      arrBD.push(dep1);
    } else if (dataArr[1].nu_documento2 !== null) {
        const data = dataArr[1].birthday1.split('/');
      const birthdayFormat2 = data ? data : null;

      const dep2 = {
        "name": dataArr[1].nm_cliente2,
        "cpf": dataArr[1].nu_documento2,
        "birthday": `${birthdayFormat2[2]}-${birthdayFormat2[1]}-${birthdayFormat2[0]}`,
        "phone": dataArr[1].telefone2,
        "email": dataArr[1].email2,
        "zipCode": dataArr[1].zipCode2,
        "address": dataArr[1].address2,
        "city": dataArr[1].city2,
        "state": dataArr[1].state2
      }

      arrBD.push(dep2);
    } else if (dataArr[2].nu_documento3 !== null) {
        const data = dataArr[2].birthday1.split('/');
      const birthdayFormat3 = data ? data : null;

      const dep3 = {
        "name": dataArr[2].nm_cliente3,
        "cpf": dataArr[2].nu_documento3,
        "birthday": `${birthdayFormat3[2]}-${birthdayFormat3[1]}-${birthdayFormat3[0]}`,
        "phone": dataArr[2].telefone3,
        "email": dataArr[2].email3,
        "zipCode": dataArr[2].zipCode3,
        "address": dataArr[2].address3,
        "city": dataArr[2].city3,
        "state": dataArr[2].state3
      };

      arrBD.push(dep3);
    }
    
    console.log("origewm: ", arrBD);

    const response = await axios.post(`https://api.rapidoc.tech/tema/api/beneficiaries`, arrBD, {
      headers: {
        'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
        'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
        'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
      }
    });



    if (response.data.success == true) {
      //acão para registrar ativaçao da vida na rapidoc
      const franqueado = await Franqueado.findAll({
        where: { id: cliente[0].id_franqueado }
      });

      let vidasAtivas = franqueado[0].vendas;

      const novaVida = await Franqueado.update({
        vendas: parseInt(vidasAtivas) + 1,
      }, {
        where: {
          id: cliente[0].id_franqueado,
        }
      });

      //resposta para o cliente
      res.send(response.data);
      console.log("criado: ", response.data);
      return true;
    } else {
      res.send(response.data);
      console.log("erro ao criar: ", response.data);
      return false;
    }

  } catch (err) {
    res.status(400).json(err);
    console.log(err.data)
  }
});

//consultar por cpf na rapidoc
router.get('/consulta/rapidoc/:cpf', async (req, res) => {
  const response = await axios.get(`https://api.rapidoc.tech/tema/api/beneficiaries/${req.params.cpf}`, {
    headers: {
      'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
      'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
      'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
    }
  });

  res.json(response.data)
})

///ativação de dependentes
router.post('/ativacao', async (req, res) => {
  const { name,
    cpf,
    birthday,
    phone,
    email,
    zipCode,
    address,
    city,
    state,
    holder } = req.body
  //rota de testes para reservar clientes rapidoc
  try {




    const birthdayFormat = birthday.split('/'); //formatar data para 0000-00-00

    //Array principal que vai para rapidoc
    const arrBD = [
      {
        "name": name,
        "cpf": cpf,
        "birthday": `${birthdayFormat[2]}-${birthdayFormat[1]}-${birthdayFormat[0]}`,
        "phone": phone,
        "email": email,
        "zipCode": zipCode,
        "address": address,
        "city": city,
        "state": state,
        "holder": holder,
      }
    ];

    const response = await axios.post(`https://api.rapidoc.tech/tema/api/beneficiaries`, arrBD, {
           headers: {
      'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
      'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
      'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
    }
    });



    if (response.data.success == true) {
      res.send(response.data);
      console.log("if: ", response.data);
      return true;
    } else {
      res.send(response.data);
      console.log("else: ", response.data);
      return false;
    }

  } catch (err) {
    res.status(400).json(err);
    console.log(err.response.data)
  }


});






//rota de testes parada por ordem superior
async function ativarVida(res, cpf) {
  try {

    //buscar dados pelo cpf na tabela de clientes
    const cliente = await Clientes.findAll({
      where: { nu_documento: cpf }
    });

    const birthdayFormat = cliente[0].birthday.split('/'); //formatar data para 0000-00-00

    //Array principal que vai para rapidoc
    const arrBD = [
      {
        "name": cliente[0].nm_cliente,
        "cpf": cliente[0].nu_documento,
        "birthday": `${birthdayFormat[2]}-${birthdayFormat[1]}-${birthdayFormat[0]}`,
        "phone": cliente[0].telefone,
        "email": cliente[0].email,
        "zipCode": cliente[0].zip_code,
        "address": cliente[0].address,
        "city": cliente[0].city,
        "state": cliente[0].state,
        "paymentType": cliente[0].paymentType,
        "serviceType": cliente[0].serviceType,
        "holder": cliente[0].nu_documento,
        "general": ""
      }
    ];


    const dataArr = JSON.parse(cliente[0].beneficiarios);

    if (dataArr[0].nu_documento1 !== null) {
      const birthdayFormat1 = (dataArr[0].birthday1.split('/')) ? `${birthdayFormat[2]}-${birthdayFormat[1]}-${birthdayFormat[0]}` : null;

      const dep1 = {
        "name": dataArr[0].nm_cliente1,
        "cpf": dataArr[0].nu_documento1,
        "birthday": `${birthdayFormat1[2]}-${birthdayFormat1[1]}-${birthdayFormat1[0]}`,
        "phone": dataArr[0].telefone1,
        "email": dataArr[0].email1,
        "zipCode": dataArr[0].zipCode1,
        "address": dataArr[0].address1,
        "city": dataArr[0].city1,
        "state": dataArr[0].state1
      }

      arrBD.push(dep1);
    } else if (dataArr[1].nu_documento2 !== null) {
      const birthdayFormat2 = (dataArr[1].birthday2.split('/')) ? `${birthdayFormat[2]}-${birthdayFormat[1]}-${birthdayFormat[0]}` : null;

      const dep2 = {
        "name": dataArr[1].nm_cliente2,
        "cpf": dataArr[1].nu_documento2,
        "birthday": `${birthdayFormat2[2]}-${birthdayFormat2[1]}-${birthdayFormat2[0]}`,
        "phone": dataArr[1].telefone2,
        "email": dataArr[1].email2,
        "zipCode": dataArr[1].zipCode2,
        "address": dataArr[1].address2,
        "city": dataArr[1].city2,
        "state": dataArr[1].state2
      }

      arrBD.push(dep2);
    } else if (dataArr[2].nu_documento3 !== null) {
      const birthdayFormat3 = (dataArr[2].birthday3.split('/')) ? `${birthdayFormat[2]}-${birthdayFormat[1]}-${birthdayFormat[0]}` : null;

      const dep3 = {
        "name": dataArr[2].nm_cliente3,
        "cpf": dataArr[2].nu_documento3,
        "birthday": `${birthdayFormat3[2]}-${birthdayFormat3[1]}-${birthdayFormat3[0]}`,
        "phone": dataArr[2].telefone3,
        "email": dataArr[2].email3,
        "zipCode": dataArr[2].zipCode3,
        "address": dataArr[2].address3,
        "city": dataArr[2].city3,
        "state": dataArr[2].state3
      };

      arrBD.push(dep3);
    }

    const response = await axios.post(`https://sandbox.rapidoc.tech/tema/api/beneficiaries`, arrBD, {
      headers: {
        'clientId': 'd13f4321-f78e-4261-b9d6-f741da923d72',
        'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M-VtcJUO5XiDH9ImsqUswxOXv3v9pmVh_6UsuDHoOmLUnmITAh248cplIpccmQDQHBXkp68aiw90JFZuTn3c45_HrWmGdpRxt8wIwxBHimXD8bt0IY2mU3BUSvjy4p36mEuZsINjfwOOib9CZQBljKcg9UbhbDQckUFvs-Q5MF6NKFqqLL360OzhdMtcENIhOZC4qKdgfLSR5xLPaJf6CZew6YiSeuS1jlzIBxgwB2VkI4CdrjyeaVoIewy-qldf4mGu6QC16GAOWnFAs4z6YxWaQ9j-dgoZSDNOiaaJ3363blck8T0wAXJmRsMz0TezOlXthrwY2l8McctMrlyTgeBA8Ny7tztH5CQEug78bul4HfAH5gtZ-xiUPJo_pYqm4fJ4udx5t8HShHGJMxAc81imX5mF7ZAWXSyPEeWGVZqCjK49Dh96VHlTRlQXfImHOQvMIIALTrDmT6J9XIp3v5DkXdc2CjC36q0UKnFeDSDoP08_KJlbWhbRiYgD1vIKEgx1RxyFGASVY1DtkYruytRtk9qow7Cpo95WPiCrqDDBN92rn6XcdO4_NlLPzysr9FsYwwVPSl5MDehtx8Kl2mJREH0Xv0GHeULKcMtp_UEvgeqMtD8LT5y7Nem01OZaMoVJUIYehlGwvZPE_6IqMaloSqO8UWix9SrN_z_bagA',
        'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
      }
    });



    if (response.data.success == true) {
      res.send(response.data);
        console.log("if: ", response.data);
      return true;
    } else {
      res.send(response.data);
        console.log("else: ", response.data);
      return false;
    }

  } catch (err) {
    res.status(400).json(err);
    console.log(err.data)
  }

};


//atualizar quantidade de Clientes
async function countClients() {
    const franqueados = await Franqueado.findAll();
    franqueados.forEach(async (franqueado)=>{
        
         
           const linkFranqueado = await Franqueado.findAll({
              where: {
                cpf: franqueado.cpf
              }
            });

            const linkCliente = await Clientes.findAll({
              where: {
                id_franqueado: linkFranqueado[0].id
              }
            });
        

            //atualizar quantidade de Clientes
            const upFranqueado = await Franqueado.update({
                 total_clientes: linkCliente.length
                },{
                 where: {
                        cpf: franqueado.cpf
                    }
            })
          
    });
    
}



module.exports = router;




