//CONFIGS
const express = require('express');
const router = express.Router();
//const logger = require('../functions/functionLog');
//const database = require('../db');
const { sequelize, sandbox } = require('../db');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { faker } = require('@faker-js/faker');
const mailer = require('./sendMailer');

//DEBBUG
const {sendMailError, mailerNewCadastro} = require('./sendMailer.js');

//SCHEMAS
const Franqueado = require('../schema/tb_franqueado');
const Clientes = require('../schema/tb_clientes');
const Rapidoc = require('../schema/tb_rapidoc');

//controllers
const cadastroNewForm = require('../controllers/cadastroClientes/cadastroNewForm');
const { webhookActivate } = require('../controllers/auto_ativacao/webhook.js');



//Importando APIs para implementação
//Alloyal
const {CriarUsuarioAlloyal, InativaUsuarioAlloyal, AtivaUsuarioAlloyal} = require('../controllers/alloyal-oimed/cliente/cliente')


//LIBS
const { Op, Sequelize } = require('sequelize');

const secretKey = "@rfxzsklc_s+bg7t+@f6^obve=f!swr1%0838lctalor92vi";

//middleware
router.use(function timelog(req, res, next) {
  console.log('Time: ', Date.now());
  console.log(req.body);
  console.log(`URL solicitada: ${req.get('host')} - ${req.originalUrl}`);
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



//--------------------authetication--------------------------->
function auth(req, res, next) {
    const authToken = req.headers['authorization'];


    if (authToken != undefined) {

        const bearer = authToken.split(' ');
        let token = bearer[1];

        jwt.verify(token, secretKey, (err, data) => {
            if (err) {
                res.status(401);
                res.json({ success: false, message: "Token inválido" });
            } else {
                req.token = token;
                req.user = { id: data.id, nome: data.nome };

                next();
            }
        });

    } else {
        res.status(401);
        res.json({ success: false, message: "Token Inválido" });
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


//------------Rota para WP FORMS--------------------------------------->

router.post('/cadastrar/clientes/newform', cadastroNewForm.cadastrarVida)


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
      beneficiarios: JSON.stringify(req.body.beneficiarios),
      id_franqueado: req.body.id_franqueado,
      cpf_titular: "titular"
    });
    
    try{
        if(newCliente.length > 0 && req.body.id_franqueado == 26) {
            await CriarUsuarioAlloyal(newCliente);
        }
    } catch(err) {
        console.log("erro na criação aloyal: ", err.message);
    }
    

    
    
    
    
     const idFranqueado = newCliente.dataValues.id_franqueado;
    const emaildestino = newCliente.dataValues.email;

    const dataFranqueado = await Franqueado.findAll({
      where: {
        id: idFranqueado
      }
    });

    
    let sending = await mailerNewCadastro(dataFranqueado[0].dataValues, emaildestino); //obj com dados dos cliente - msg padrão - msg de erro ou success - identificador do painel
    

    const arrayDefault = '[{"nm_cliente1":null,"nu_documento1":null,"birthday1":null,"email1":null,"telefone1":null,"zipCode1":null,"address1":null,"city1":null,"state1":null},{"nm_cliente2":null,"nu_documento2":null,"birthday2":null,"email2":null,"telefone2":null,"zipCode2":null,"address2":null,"city2":null,"state2":null},{"nm_cliente3":null,"nu_documento3":null,"birthday3":null,"email3":null,"telefone3":null,"zipCode3":null,"address3":null,"city3":null,"state3":null}]';

    if (newCliente) {
        const beneficiary = JSON.parse(req.body.beneficiarios);
      beneficiary.map(async (beneficiario, i) => {
        var contador = i + 1;
        if (beneficiario["nm_cliente" + contador] != null) {
          const newBeneficiario = await Clientes.create({
            nm_cliente: beneficiario["nm_cliente" + contador],
            nu_documento: beneficiario["nu_documento" + contador],
            birthday: beneficiario["birthday" + contador],
            telefone: beneficiario["telefone" + contador],
            email: beneficiario["email" + contador],
            zip_code: beneficiario["zipCode" + contador],
            address: beneficiario["address" + contador],
            city: beneficiario["city" + contador],
            state: beneficiario["state" + contador],
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
            link: "default",
            beneficiarios: arrayDefault,
            id_franqueado: req.body.id_franqueado,
            cpf_titular: numericCpfNumber
          });
        
          

        }

      });
      res.json({ success: true, message: "criado com sucesso" });
    }



    //res.json(newCliente);

  } catch (err) {
      //console.log(err)
       res.json({ success: false, message: err });
    //return res.status(400).json(err)
  }

});

//rota de testes para atualizar dados de clientes
router.put('/franqueado/clientes/update', async (req, res) => {
  try {
    await sequelize.sync();

    console.log("request de atualização", req.body);

    var cpfNumber = req.body.nu_documento;
    var numericCpfNumber = cpfNumber.replace(/\D/g, "");
    
    var cpfOriginal = req.body.documento_original;
    var numericCpfOriginal = cpfOriginal.replace(/\D/g, "");
    
    //console.log(numericCpfNumber);

    const newCliente = await Clientes.update({
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
      //situacao: "ativo",
      nu_parcelas: "default",
      vl_venda: "default",
      dt_cobranca: "default",
      dt_vencimento: "default",
      dt_pagamento: "default",
      par_atual: "default",
      paymentType: req.body.paymentType,
      serviceType: req.body.serviceType,
      link: req.body.link,
      beneficiarios: JSON.stringify(req.body.beneficiarios),
      id_franqueado: req.body.id_franqueado,
      //cpf_titular: "titular"
    }, {
      where: {
          [Op.or]: [
                  {nu_documento: numericCpfOriginal},
                  {nu_documento: cpfOriginal},
                  {nu_documento: cpfNumber},
                  {nu_documento: numericCpfNumber},
              ]
      }
    });
    
    //console.log("mycliente", newCliente)

    criarDependenteGeral()

    function criarDependenteGeral() {
      const arrayDefault = '[{"nm_cliente1":null,"nu_documento1":null,"birthday1":null,"email1":null,"telefone1":null,"zipCode1":null,"address1":null,"city1":null,"state1":null},{"nm_cliente2":null,"nu_documento2":null,"birthday2":null,"email2":null,"telefone2":null,"zipCode2":null,"address2":null,"city2":null,"state2":null},{"nm_cliente3":null,"nu_documento3":null,"birthday3":null,"email3":null,"telefone3":null,"zipCode3":null,"address3":null,"city3":null,"state3":null}]';

      // if (newCliente) {

      req.body.beneficiarios.map(async (beneficiario, i) => {
        var contador = i + 1;
        if (beneficiario["nm_cliente" + contador] != null) {
          try {
            const newBeneficiario = await Clientes.create({
              nm_cliente: beneficiario["nm_cliente" + contador],
              nu_documento: beneficiario["nu_documento" + contador],
              birthday: beneficiario["birthday" + contador],
              telefone: beneficiario["telefone" + contador],
              email: beneficiario["email" + contador],
              zip_code: beneficiario["zipCode" + contador],
              address: beneficiario["address" + contador],
              city: beneficiario["city" + contador],
              state: beneficiario["state" + contador],
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
              link: "default",
              beneficiarios: arrayDefault,
              id_franqueado: req.body.id_franqueado,
              cpf_titular: numericCpfNumber
            }, {
              where: {
                nu_documento: beneficiario["nu_documento" + contador]
              }
            });
          } catch (err) {
            const newBeneficiario = await Clientes.update({
              nm_cliente: beneficiario["nm_cliente" + contador],
              nu_documento: beneficiario["nu_documento" + contador],
              birthday: beneficiario["birthday" + contador],
              telefone: beneficiario["telefone" + contador],
              email: beneficiario["email" + contador],
              zip_code: beneficiario["zipCode" + contador],
              address: beneficiario["address" + contador],
              city: beneficiario["city" + contador],
              state: beneficiario["state" + contador],
              dt_venda: "default",
              //situacao: "Pendente",
              nu_parcelas: "default",
              vl_venda: "default",
              dt_cobranca: "default",
              dt_vencimento: "default",
              dt_pagamento: "default",
              par_atual: "default",
              paymentType: req.body.paymentType,
              serviceType: req.body.serviceType,
              link: "default",
              beneficiarios: arrayDefault,
              id_franqueado: req.body.id_franqueado,
              cpf_titular: numericCpfNumber
            }, {
              where: {
                nu_documento: beneficiario["nu_documento" + contador]
              }
            });
          }

        }

      });

      res.json({ success: true, message: "atualizado com sucesso" });

      //}
    };




    //res.json(newCliente);

  } catch (err) {
     res.status(400)
     res.json(err)
     console.log(err)
  }

});

//rota de testes para reservar clientes automatico fpay e cobrefacil
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
        situacao: statusParam,
        id_franqueado: req.body.id
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


//buscar cliente por id
router.get('/buscar/cliente/:id', async (req, res) => {
  console.log(req.params.id)
  if (!req.params.id) {
    res.json({ success: false, message: "erro no identificador" })
  } else {
    const cliente = await Clientes.findAll({
      where: {
        id: req.params.id
      }
    });

    res.json({ success: true, message: cliente })
  }

  /* res.json(linkFranqueado[0].link) */
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

//buscar cliente por cpf
router.get('/clientes/search/list/:cpf', async (req, res) => {
  const nmClientes = await Clientes.findAll({
    where: { nu_documento: req.params.cpf }
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
          [Op.or]: [
              {id: req.body.id},
              {nu_documento: req.body.id},
            ]
      
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
  try{
      await InativaUsuarioAlloyal(cpf);
  }catch(err) {
      console.log("erro ao inativar: ", err.message)
  }
    
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
            
            const cliente = await Clientes.update({
              dtDesativacao: new Date()
            }, {
              where: { nu_documento: cpf }
            });
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
        console.log("caminho do erro: api.js linha 882")
    }


});

//reativar vida
router.put('/beneficiaries/reactivate/:cpf', async (req, res) => {
     const cpfinformed = req.params.cpf;
    
    try{
        await AtivaUsuarioAlloyal(cpfinformed);
    } catch(err) {
        console.log("erro reativar aloyal 962", err.message)
    }
    
    try{

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
        console.log("caminho do erro: Routes.js linha 914")
        //console.log("erro do reactivate: ", err)
    }
});

///ativar vida manualmente via painel oimed
router.post('/beneficiaries/create/:cpf', async (req, res) => {
  const cpf = req.params.cpf;
  
      if(req.body == 1) {
          
            //configuracao da data
            const myDate = req.body.birthday;
            console.log(req.body)
            
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
                "name": req.body.name,
                "cpf": req.body.cpf,
                "birthday": birthdayFormat,
                "phone": req.body.phone,
                "email": req.body.email,
                "zipCode": req.body.zipCode,
                "address": req.body.address,
                "city": req.body.city,
                "state": req.body.state,
                "paymentType": "S",
                "serviceType": "G",
                "holder": req.body.holder,
                "general": ""
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
              //acão para registrar ativaçao da vida na rapidoc
             /* const franqueado = await Franqueado.findAll({
                where: { id: cliente[0].id_franqueado }
              });
        
              let vidasAtivas = franqueado[0].vendas;
        
              const novaVida = await Franqueado.update({
                vendas: parseInt(vidasAtivas) + 1,
              }, {
                where: {
                  id: cliente[0].id_franqueado,
                }
              });*/
        
              //resposta para o cliente
              res.send(response.data);
              console.log(response.data)
              console.log("criado: ", response.data);
              return true;
            } else {
              res.send(response.data);
              console.log("erro ao criar indie: ", response.data);
              return false;
            }
      }

    //buscar dados pelo cpf na tabela de clientes
    const cliente = await Clientes.findAll({
      where: { nu_documento: cpf }
    });
    
        if(cliente.length < 1) {
            return;
        }
 

    //configuracao da data
    const myDate = cliente[0].birthday;

    
    const dia = myDate.substr(0, 2);
    const mes = myDate.substr(2, 2);
    const ano = myDate.substr(4, 4);

    const dataVerify = /\//.test(myDate);
    
    var modifieData1 = () => {
        const dataSplit = myDate.split('/');
  
        const format = `${dataSplit[2]}-${dataSplit[1]}-${dataSplit[0]}`;
         
        // Regex para encontrar um espaço em branco em qualquer lugar na string
        const cleanedDateString = format.replace(/\s/g, '');
        
        return cleanedDateString;
    };
    
    var modifieData2 = `${ano}-${mes}-${dia}`;

    const birthdayFormat =  dataVerify ? modifieData1() : modifieData2; //formatar data para 0000-00-00
    
    console.log(modifieData2, birthdayFormat)

    //Array principal que vai para rapidoc
    const arrBD = [
      {
        "name": cliente[0].nm_cliente,
        "cpf": cliente[0].nu_documento,
        "birthday": birthdayFormat,
        "phone": cliente[0].telefone,
        "email": cliente[0].email,
        "zipCode": cliente[0].zip_code,
        "address": "rua do teste, 01",//cliente[0].address,
        "city": cliente[0].city,
        "state": cliente[0].state.substr(cliente[0].state.length-3, 2),
        "paymentType": cliente[0].paymentType,
        "serviceType": cliente[0].serviceType,
        "holder": "",
        "general": ""
      }
    ];





    //console.log("clientessssssssssssssss", cliente[0])
    const dataArr = JSON.parse(cliente[0].beneficiarios);
    //console.log("debug: ", dataArr)
    //console.log(dataArr[0].birthday1)
    //try {
        
    if (dataArr[0].nu_documento1 != null) {
        console.log("testando")
        const data = dataArr[0].birthday1.split('/');
      const birthdayFormat1 = data ? data : null;
      
      console.log("teste da data", dataArr[0].nu_documento1)

      const dep1 = {
        "name": dataArr[0].nm_cliente1,
        "cpf": dataArr[0].nu_documento1,
        "birthday": `${birthdayFormat1[2]}-${birthdayFormat1[1]}-${birthdayFormat1[0]}`,
        "phone": dataArr[0].telefone1,
        "email": dataArr[0].email1,
        "zipCode": dataArr[0].zipCode1,
        "address": dataArr[0].address1,
        "city": dataArr[0].city1,
        "state": dataArr[0].state1.substr(cliente[0].state1.length-3, 2),
        "holder": cliente[0].nu_documento
      }

      arrBD.push(dep1);
    } else if (dataArr[1].nu_documento2 != null) {
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
        "state": dataArr[1].state2.substr(cliente[0].state2.length-3, 2),
        "holder": cliente[0].nu_documento
      }

      arrBD.push(dep2);
    } else if (dataArr[2].nu_documento3 != null) {
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
        "state": dataArr[2].state3.substr(cliente[0].state3.length-3, 2),
        "holder": cliente[0].nu_documento
      };

      arrBD.push(dep3);
    }
        
   // } catch(err) {
    //    console.log("erro ao montar registro - linha 1215: ", err.message)
    //}
 
      console.log("debug: ", dataArr)
    console.log("origewm: ", arrBD);
    
 try {
    const response = await axios.post(`https://api.rapidoc.tech/tema/api/beneficiaries`, arrBD, {
          headers: {
            'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
            'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
            'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
          }
        });
    
    console.log("resposta: ", response.data)




//console.log("0---------------> ", response.data)

    if (response.data.success == true) {
        
        
      const cliente = await Clientes.update({
          dtAtivacao: new Date()
        }, {
          where: { nu_documento: cpf }
        });
        
      //acão para registrar ativaçao da vida na rapidoc
     /* const franqueado = await Franqueado.findAll({
        where: { id: cliente[0].id_franqueado }
      });

      let vidasAtivas = franqueado[0].vendas;

      const novaVida = await Franqueado.update({
        vendas: parseInt(vidasAtivas) + 1,
      }, {
        where: {
          id: cliente[0].id_franqueado,
        }
      });*/

      //resposta para o cliente
      res.send(response.data);
      console.log(response.data)
      console.log("criado: ", response.data);
       let sending = await sendMailError(arrBD, "Vida cadastrada na Central principal", response.data, cliente[0].id_franqueado, "CONCLUIDO"); //obj com dados dos cliente - msg padrão - msg de erro ou success - identificador do painel
      return true;
    } else {
      res.send(response.data);
      console.log("erro ao criar: ", response.data);
      console.log("kledisom")
       let sending = await sendMailError(arrBD, "Vida não cadastrada na Central principal", response.data, cliente[0].id_franqueado, "PENDENTE");
         //let sendingCadastro = await mailerNewCadastro([], "Vida cadastrada na Central principal", 'response.data, cliente[0].id_franqueado', "CONCLUIDO"); //obj com dados dos cliente - msg padrão - msg de erro ou success - identificador do painel

      return false;
    }

  } catch (err) {
    res.json(err.message);
    res.status(400);
    let sending = await sendMailError(arrBD, "Vida não cadastrada na Central principal", err.data, cliente[0].id_franqueado, "PENDENTE");
    console.log("caminho do erro: Routes.js linha 1166", err.message)
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
      'Content-Type': 'application/json'
      //'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
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
 console.log("caminho do erro: api.js linha 1242")
  }


});


//webhook
router.post('/oimed/webhook/:id', async (req, res) => {
  const parceiroID = req.params.id;

  const token = await Franqueado.findAll({
    where: {
      id: parceiroID
    }
  });


  webhookActivate(req.body, token[0].tokenAsaas, res);
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




