//CONFIGS
const express = require('express');
const router = express.Router();
//const logger = require('../functions/functionLog');
//const database = require('../db');
const { sequelize, sandbox } = require('../db');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');
const mailer = require('./sendMailer');

//DEBBUG
const { sendMailError,
  mailerNewCadastro,
  mailerNewCadastroModel2,
  mailerNewCadastroModel3,
  mailerNewCadastroConnectVitta } = require('./sendMailer.js');

//SCHEMAS
const Franqueado = require('../schema/tb_franqueado');
const Clientes = require('../schema/tb_clientes');
const Rapidoc = require('../schema/tb_rapidoc');
const SubFranqueado = require('../schema/tb_sub_franqueado');
const SubClientes = require('../schema/tb_sub_clientes.js');
const Planos = require('../schema/tb_planos.js');
const { relacPlanos } = require('../schema/index.js');
const Sleeping = require('../schema/tb_sleeping');
const dormir = require('../functions/crud');

//controllers
const cadastroNewForm = require('../controllers/cadastroClientes/cadastroNewForm');
const cadastroNewFormFromWoo = require('../controllers/cadastroClientes/cadastroNewFormFromWoo.js');
const paymentReminder = require('../controllers/telemedicinaActions/notifications.js');
const loginWordpress = require('../controllers/login/loginForWp.js');
const sub_franqueados = require('../controllers/sub_franqueados/crud.js');
const yampi = require('../controllers/yampi/index.js');
const faturamento = require('../controllers/faturamento/index.js');
const { webhookActivate, webhookInactivate } = require('../controllers/auto_ativacao/webhook.js');
const credentialsApiController = require('../controllers/integracoes/apiKeys/credentialsApiController');
const loginConsulta = require('../controllers/login/login-consulta.js');
const { ativarBeneficiarioSubpainel } = require('../controllers/sub_franqueados/ativarBeneficiario.js');



//Importando APIs para implementação
//Alloyal
const { CriarUsuarioAlloyal, InativaUsuarioAlloyal, AtivaUsuarioAlloyal } = require('../controllers/alloyal-oimed/cliente/cliente');

//MULTER
const multer = require('multer');
const path = require('path');
const upload = multer({ dest: path.join(__dirname, '../uploads/temp') });


//LIBS
const { Op, Sequelize, literal } = require('sequelize');
//const { Op, literal } = require('sequelize');

const secretKey = process.env.JWT_SECRET || "@rfxzsklc_s+bg7t+@f6^obve=f!swr1%0838lctalor92vi";

// Helper para extrair o token JWT de cabeçalhos ou query
function extractToken(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      return parts[1];
    }
    return authHeader.trim();
  }
  if (req.headers['x-access-token']) {
    return req.headers['x-access-token'];
  }
  if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
}

// Whitelist rigorosa de rotas públicas (que não necessitam de token JWT)
function isPublicRoute(req) {
  const path = req.path;
  const method = req.method.toUpperCase();

  // Permite preflight de CORS
  if (method === 'OPTIONS') return true;

  // Healthcheck raiz
  if (method === 'GET' && (path === '/' || path === '/newFeat')) return true;

  // APIs externas de integração de parceiros (production / sandbox) e Swagger
  // Possuem autenticação própria baseada em API Key / JWT da integração
  if (
    path.startsWith('/production') ||
    path.startsWith('/sandbox') ||
    path.startsWith('/api-docs') ||
    path.startsWith('/cadastro/oimed') ||
    path === '/login-consulta' ||
    path === '/thankyou' ||
    path === '/mailerr'
  ) {
    return true;
  }

  // Endpoints públicos de login e autenticação
  if (method === 'POST') {
    if (path === '/auth' || path === '/wp/auth' || path === '/wp/login' || path === '/login/consulta') {
      return true;
    }
    // Formulários públicos externos de cadastro
    if (path === '/wp/clientes/newform' || path === '/cadastrar/clientes/newform') {
      return true;
    }
    // Webhooks externos de pagamentos / integrações parceiras
    if (path.startsWith('/oimed/webhook/') || path === '/conectamed/notification') {
      return true;
    }
  }

  // Crons de cobrança externa
  if (method === 'GET' && (path === '/payment/reminder/7' || path === '/payment/reminder/1')) {
    return true;
  }

  return false;
}

// Log seguro (evita vazar senhas, tokens e dados sensíveis de pacientes nos logs do servidor)
router.use(function secureLog(req, res, next) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Middleware Global de Autenticação - Bloqueia qualquer endpoint fora da whitelist
function globalAuth(req, res, next) {
  if (isPublicRoute(req)) {
    return next();
  }

  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Acesso não autorizado. Token de autenticação não fornecido."
    });
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        success: false,
        message: "Acesso não autorizado. Token inválido ou expirado."
      });
    }

    req.token = token;
    req.user = decoded;
    req.loggerUser = decoded;
    next();
  });
}

// Aplica autenticação globalmente a todas as rotas deste router
router.use(globalAuth);

// Compatibilidade para rotas que referenciam auth explicitamente
function auth(req, res, next) {
  if (req.user) {
    return next();
  }
  return globalAuth(req, res, next);
}

// Middleware exclusivo para Administradores (valida autoridade e perfil a partir do token assinado)
function adminAuth(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, message: "Acesso não autorizado. Token ausente ou inválido." });
  }

  if (user.autoridade !== 1 && user.perfil !== 'master') {
    return res.status(403).json({ success: false, message: "Acesso restrito apenas a Administradores." });
  }
  next();
}

// Formulário público do WooCommerce
router.post('/wp/clientes/newform', cadastroNewFormFromWoo.cadastrarVida);


router.post('/auth', async (req, res) => {
  const { api_key, secret_key, apiKey, secretKey: secretKeyBody, email, password } = req.body || {};
  const resolvedApiKey = api_key || apiKey;
  const resolvedSecretKey = secret_key || secretKeyBody;

  // Se forem fornecidas credenciais de API (api_key e secret_key), autentica como parceiro/integração
  if (resolvedApiKey && resolvedSecretKey) {
    try {
      const CredentialsApi = require('../schema/tb_credentialsApi');
      const credentialKey = await CredentialsApi.findOne({
        where: {
          api_key: resolvedApiKey,
          secret_key: resolvedSecretKey,
          status: 'ativo'
        },
        raw: true
      });

      if (!credentialKey) {
        return res.status(401).json({ success: false, message: "Credenciais de API inválidas ou inativas." });
      }

      const apiSecret = "@rfxzsklc_s+bg7t+@f6^obve=f!swr1%0838lctalor92vi";
      const token = jwt.sign({ id: credentialKey.id, user: credentialKey.nome }, apiSecret, { expiresIn: '8h' });
      return res.json({ success: true, token, modo: credentialKey.modo });
    } catch (errApi) {
      console.error("Erro na autenticação por API key em /auth:", errApi);
      return res.status(500).json({ success: false, message: "Erro interno na autenticação da API." });
    }
  }

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "E-mail e senha são obrigatórios." });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPassword = String(password).trim();

  try {
    const user = await Franqueado.findOne({
      where: { email: cleanEmail }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "E-mail não encontrado ou credenciais inválidas." });
    }

    let passwordMatches = false;
    // 1. Tenta validar via hash bcrypt
    try {
      passwordMatches = bcrypt.compareSync(password, user.password);
    } catch (e) {
      passwordMatches = false;
    }

    // 2. Se não bateu via bcrypt, verifica se ainda é senha em texto puro (migração transparente)
    if (!passwordMatches && user.password === password) {
      passwordMatches = true;
      // Atualiza automaticamente o registro no banco com hash seguro bcrypt
      try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        await Franqueado.update({ password: hashedPassword }, { where: { id: user.id } });
        console.log(`[Segurança] Senha do usuário ID ${user.id} migrada para hash bcrypt com sucesso.`);
      } catch (errHash) {
        console.error("Erro ao atualizar hash de senha:", errHash);
      }
    }

    if (!passwordMatches || user.status !== "ativo") {
      return res.status(401).json({ success: false, message: "Credenciais inválidas ou usuário inativo." });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      nome: user.nome || '',
      role: user.subPaineis,
      autoridade: user.autoridade,
      perfil: user.perfil || (user.autoridade === 1 ? 'master' : (user.subPaineis ? 'sub' : 'parceiro')),
      products: user.products
    };

    jwt.sign(tokenPayload, secretKey, { expiresIn: '8h' }, (err, token) => {
      if (err) {
        console.error("Erro ao assinar JWT:", err);
        return res.status(500).json({ success: false, message: "Falha interna ao gerar token de acesso." });
      }

      res.status(200).json({
        success: true,
        message: "Usuário autenticado com sucesso",
        token: token,
        perfil: tokenPayload.perfil,
        id: user.id,
        nome: user.nome,
        products: user.products,
        role: user.subPaineis,
        autoridade: user.autoridade
      });
    });
  } catch (err) {
    console.error("Erro na autenticação:", err);
    res.status(500).json({ success: false, message: "Erro no servidor ao processar login." });
  }
});

router.put('/change/password/:idFranqueado', async (req, res) => {
  const idFranqueado = req.params.idFranqueado;

  // Garante que o usuário só pode alterar sua própria senha, a menos que seja administrador
  const isSelf = req.user && String(req.user.id) === String(idFranqueado);
  const isAdmin = req.user && (req.user.autoridade === 1 || req.user.perfil === 'master');

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ success: false, message: "Acesso negado: Você não tem permissão para alterar a senha deste franqueado." });
  }

  const newPassword = req.body.password ? String(req.body.password).trim() : '';
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "A nova senha deve ter no mínimo 6 caracteres." });
  }

  try {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await Franqueado.update({
      password: hashedPassword
    }, {
      where: {
        id: idFranqueado
      }
    });

    res.status(200).json({ success: true, message: "Senha alterada com sucesso!" });
  } catch (err) {
    console.error("Erro ao alterar senha:", err);
    res.status(500).json({ success: false, message: "Erro interno ao atualizar senha." });
  }
});

//rotas para wordpress
router.post('/wp/auth', async (req, res) => {

  var { login, pass } = req.body;
  console.log(login)


  try {
    if (login != undefined) {

      //var user = DB.users.find(u => u.email == email);

      const linkUsuarios = await Clientes.findAll();

      //res.json(linkUsuarios);

      var user = linkUsuarios.find(u => u.nu_documento == login);
      let password = user.nu_documento.substr(0, 4);

      /*  res.json({teste: password});
       return; */

      if (user != undefined) {
        if (password == pass) {

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
                data: user
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
  } catch (err) {
    res.json({ "success": false, "message": err })
  }


});

router.get('/wp/dependentes/:idd', async (req, res) => {

  var idd = req.params.idd;

  const resultDependentes = await Clientes.findAll({
    where: {
      cpf_titular: idd
    }
  });

  res.json({ success: true, dependentes: resultDependentes });


});

router.get('/wp/pagamentos', async (req, res) => {

  function customerId() {
    const url = 'https://api.asaas.com/v3/customers?cpfCnpj=' + req.headers.doc;
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        access_token: req.headers.key
      }
    };

    fetch(url, options)
      .then(res => res.json())
      .then(json => {
        if (json.data.length > 0) {
          assinaturas(json.data[0])
        } else {
          res.json({ success: false, message: "não encontrado" })
        }
      })
      .catch(err => {
        res.status(401).json({ success: false, message: "não autorizado" })
        console.error("kledisom", err)
      });
  };

  customerId()

  function assinaturas(idd) {

    const url = 'https://api.asaas.com/v3/subscriptions?customer=' + idd.id;
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        access_token: req.headers.key
      }
    };

    fetch(url, options)
      .then(response => response.json())
      .then(json => res.json({ success: true, assinaturas: json.data, usuario: idd.name }))
      .catch(err => console.error(err));
    console.log(url, req.headers.key)
  };



  //res.json({success: true, dependentes: resultDependentes});


});

//rota principal
router.get('/', async (req, res) => {
  res.json({ message: 'funcionando', status: 200 });
});

//rota de testes para adicionar franqueados
router.post('/franqueado', adminAuth, async (req, res) => {

  try {
    await sequelize.sync();

    console.log(req.body);


    const rawPassword = req.body.password ? String(req.body.password).trim() : faker.string.hexadecimal({ length: 12 });
    const hashedPassword = bcrypt.hashSync(rawPassword, 10);

    const newFranqueado = await Franqueado.create({
      nome: req.body.nome,
      cpf: req.body.cpf,
      telefone: req.body.telefone,
      email: req.body.email,
      password: hashedPassword,
      total_clientes: '0',
      vendas: '0',
      dado_banc: req.body.nu_banco,
      dado_pix: req.body.chave_pix,
      site_venda: req.body.site_url,
      status: 'ativo',
      perfil: 'guest',
      siteTitle: req.body.nome_projeto,
      siteEmail: req.body.email_projeto,
      emailModel: parseInt(req.body.modelo_email),
      //precoIndividual: req.body["valor-individual"],
      //precoFamiliar: req.body["valor-familiar"],
      //products: req.body.products,
      subPaineis: req.body.sub_paineis,
      autoridade: 3
    });

    const precos = await Promise.all(
      Object.entries(req.body.individual).map(async ([key, value]) => {
        const tipo = key.split('-')[1]; // ex: de "individual-p" vira "p"
        return await Planos.create({
          id_franqueado: newFranqueado.id,
          plano: 'individual',
          tipo,
          valor: value, // pega o valor do campo correspondente
          manutencao_mensal: 197
        });
      })
    );

    await Promise.all(
      Object.entries(req.body.familiar).map(async ([key, value]) => {
        const tipo = key.split('-')[1];
        return await Planos.create({
          id_franqueado: newFranqueado.id,
          plano: 'familiar',
          tipo,
          valor: value,
          manutencao_mensal: 197
        });
      })
    );

    res.json({
      ...newFranqueado.dataValues,
      temporaryPassword: rawPassword
    });

  } catch (err) {
    return res.status(400).json(err)
  }

});

// Obter personalização visual do painel do parceiro
router.get('/franqueado/customizacao', async (req, res) => {
  try {
    const isAdmin = req.user && (req.user.autoridade === 1 || req.user.perfil === 'master');
    const partnerId = (isAdmin && req.query.partnerId) ? req.query.partnerId : (req.user?.id || req.query.id);

    if (!partnerId) {
      return res.status(400).json({ success: false, message: 'Identificador do parceiro ausente' });
    }

    const franqueado = await Franqueado.findOne({
      where: { id: partnerId },
      attributes: ['id', 'nome', 'siteTitle', 'customizacao']
    });

    if (!franqueado) {
      return res.status(404).json({ success: false, message: 'Parceiro não encontrado' });
    }

    let customData = null;
    if (franqueado.customizacao) {
      try {
        customData = typeof franqueado.customizacao === 'string'
          ? JSON.parse(franqueado.customizacao)
          : franqueado.customizacao;
      } catch (e) {
        customData = null;
      }
    }

    // Padrões se não houver customização configurada
    const defaultConfig = {
      logoUrl: '',
      primaryColor: '#2563eb',
      secondaryColor: '#1d4ed8',
      brandName: franqueado.siteTitle || franqueado.nome || 'OIMED',
      sidebarTheme: 'dark'
    };

    const finalConfig = {
      ...defaultConfig,
      ...(customData || {})
    };

    return res.json({
      success: true,
      partnerId: franqueado.id,
      customizacao: finalConfig
    });
  } catch (error) {
    console.error('Erro ao buscar customizacao:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao consultar personalização' });
  }
});

// Salvar/atualizar personalização visual do painel do parceiro
router.put('/franqueado/customizacao', async (req, res) => {
  try {
    const isAdmin = req.user && (req.user.autoridade === 1 || req.user.perfil === 'master');
    const partnerId = (isAdmin && req.body.partnerId) ? req.body.partnerId : req.user?.id;

    if (!partnerId) {
      return res.status(400).json({ success: false, message: 'Identificador do parceiro não informado' });
    }

    const franqueado = await Franqueado.findOne({ where: { id: partnerId } });
    if (!franqueado) {
      return res.status(404).json({ success: false, message: 'Parceiro não encontrado' });
    }

    // Validação de permissão: apenas administradores ou parceiros com módulo 'personalizacao' liberado
    if (!isAdmin) {
      let hasPerm = false;
      if (franqueado.products) {
        try {
          const prods = typeof franqueado.products === 'string' ? JSON.parse(franqueado.products) : franqueado.products;
          if (Array.isArray(prods) && prods.includes('personalizacao')) {
            hasPerm = true;
          }
        } catch {
          if (typeof franqueado.products === 'string' && franqueado.products.includes('personalizacao')) {
            hasPerm = true;
          }
        }
      }
      if (!hasPerm) {
        return res.status(403).json({
          success: false,
          message: 'Você não possui permissão para personalizar o painel. Solicite a liberação deste módulo ao administrador.'
        });
      }
    }

    let currentCustom = {};
    if (franqueado.customizacao) {
      try {
        currentCustom = typeof franqueado.customizacao === 'string'
          ? JSON.parse(franqueado.customizacao)
          : franqueado.customizacao;
      } catch (e) {
        currentCustom = {};
      }
    }

    const { logoUrl, primaryColor, secondaryColor, brandName, sidebarTheme, ...extraConfig } = req.body;

    // Sanitiza e mescla configurações
    const updatedCustom = {
      ...currentCustom,
      ...extraConfig,
      logoUrl: logoUrl !== undefined ? logoUrl : (currentCustom.logoUrl || ''),
      primaryColor: primaryColor || currentCustom.primaryColor || '#2563eb',
      secondaryColor: secondaryColor || currentCustom.secondaryColor || '#1d4ed8',
      brandName: brandName !== undefined ? brandName : (currentCustom.brandName || franqueado.siteTitle || franqueado.nome || 'OIMED'),
      sidebarTheme: sidebarTheme || currentCustom.sidebarTheme || 'dark',
      updatedAt: new Date().toISOString()
    };

    const updateFields = {
      customizacao: JSON.stringify(updatedCustom)
    };

    if (brandName) {
      updateFields.siteTitle = brandName;
    }

    await Franqueado.update(updateFields, { where: { id: partnerId } });

    return res.json({
      success: true,
      message: 'Personalização salva com sucesso!',
      customizacao: updatedCustom
    });
  } catch (error) {
    console.error('Erro ao atualizar customizacao:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao salvar personalização' });
  }
});

//rota de testes para atualizar franqueados
router.put('/franqueado/putproducts', adminAuth, async (req, res) => {
  try {
    const rawProducts = req.body.products;
    const productsStr = typeof rawProducts === 'object' ? JSON.stringify(rawProducts) : String(rawProducts || '[]');
    const hasSubPaineis = productsStr.includes('sub-paineis');

    await Franqueado.update({
      products: productsStr,
      subPaineis: hasSubPaineis
    }, {
      where: {
        id: req.body.id,
      }
    });

    res.json({ success: true, message: "Permissões atualizadas com sucesso", products: productsStr });

  } catch (err) {
    console.error("Erro ao atualizar produtos/permissões:", err);
    return res.status(400).json({ success: false, message: "Erro ao atualizar permissões", error: err.message });
  }
});

router.put('/franqueado/:clientId', adminAuth, async (req, res) => {
  try {

    const newFranqueado = await Franqueado.update({
      nome: req.body.nome,
      cpf: req.body.cpf,
      telefone: req.body.telefone,
      email: req.body.email,
      //password: faker.string.hexadecimal({ length: 12 }),
      total_clientes: '0',
      vendas: '0',
      dado_banc: req.body.nu_banco,
      dado_pix: req.body.chave_pix,
      site_venda: req.body.site_url,
      status: 'ativo',
      perfil: 'guest',
      siteTitle: req.body.nome_projeto,
      siteEmail: req.body.email_projeto,
      emailModel: parseInt(req.body.modelo_email),
      linkApple: req.body.link_app_ios,
      linkAndroid: req.body.link_app_android,
      precoIndividual: req.body["valor-individual"],
      precoFamiliar: req.body["valor-familiar"],
      //products: req.body.products,
      subPaineis: req.body.sub_paineis,
      autoridade: 3
    }, {
      where: {
        id: req.params.clientId,
      }
    });

    console.log(req.body);
    const precos = await Promise.all(
      Object.entries(req.body.individual).map(async ([key, value]) => {
        const tipo = key.split('-')[1]; // ex: de "individual-p" vira "p"
        console.log(tipo, value);
        return await Planos.update({
          valor: value, // pega o valor do campo correspondente
        }, {
          where: {
            id_franqueado: req.params.clientId,
            tipo: tipo,
            plano: 'individual'
          }
        });
      })
    );

    await Promise.all(
      Object.entries(req.body.familiar).map(async ([key, value]) => {
        const tipo = key.split('-')[1];
        console.log(tipo, value);
        return await Planos.update({
          valor: value,
        }, {
          where: {
            id_franqueado: req.params.clientId,
            tipo: tipo,
            plano: 'familiar'
          }
        });
      })
    );


    res.json(newFranqueado);

  } catch (err) {
    console.log(err)
    return res.status(400).json(err)
  }

});




//------------Rota para WP FORMS--------------------------------------->

router.post('/cadastrar/clientes/newform', cadastroNewForm.cadastrarVida);

router.post('/wp/login', loginWordpress.loginWp);

//rota para cadastrar clientes e dependentes (Plano Individual ou Familiar)
router.post('/franqueado/clientes', async (req, res) => {
  try {
    console.log("Cadastro de novo cliente - body recebido:", req.body);

    const idFranqueadoFinal = req.body.id_franqueado || req.body.idParceiro || req.user?.id;
    if (!idFranqueadoFinal) {
      return res.status(400).json({ success: false, message: "Identificador do parceiro/franqueado é obrigatório." });
    }

    const nmClienteTitular = req.body.nm_cliente ? String(req.body.nm_cliente).trim() : '';
    if (!nmClienteTitular) {
      return res.status(400).json({ success: false, message: "Nome do titular é obrigatório." });
    }

    const numericCpfTitular = String(req.body.nu_documento || '').replace(/\D/g, "");
    if (!numericCpfTitular || numericCpfTitular.length !== 11) {
      return res.status(400).json({ success: false, message: "CPF do titular inválido (deve conter 11 dígitos numéricos)." });
    }

    const planoCobertura = String(req.body.cobertura || 'individual').toLowerCase().trim();
    const isFamiliar = planoCobertura === 'familiar';

    // Formatar telefone removendo caracteres não numéricos e prefixo 55
    const telefoneInformado = (numero) => {
      if (!numero) return '00000000000';
      const limpo = String(numero).replace(/\D/g, '').replace(/^55/, '');
      return limpo.length >= 8 ? limpo : '00000000000';
    };

    // Defaults do Titular
    const defaultZipCode = (req.body.zip_code && String(req.body.zip_code).trim() !== '') ? String(req.body.zip_code).trim() : '00000000';
    const defaultAddress = (req.body.address && String(req.body.address).trim() !== '') ? String(req.body.address).trim() : 'Não informado';
    const defaultCity = (req.body.city && String(req.body.city).trim() !== '') ? String(req.body.city).trim() : 'Não informada';
    const defaultState = (req.body.state && String(req.body.state).trim() !== '') ? String(req.body.state).trim() : 'SP';
    const defaultBirthday = (req.body.birthday && String(req.body.birthday).trim() !== '') ? String(req.body.birthday).trim() : '01/01/2000';
    const defaultEmail = (req.body.email && String(req.body.email).trim() !== '') ? String(req.body.email).trim() : 'sem-email@oimed.com.br';
    const defaultPaymentType = (req.body.paymentType && String(req.body.paymentType).trim() !== '') ? String(req.body.paymentType).trim() : 'S';
    const defaultServiceType = (req.body.serviceType && String(req.body.serviceType).trim() !== '') ? String(req.body.serviceType).trim() : 'GSP';
    const defaultLink = (req.body.link && String(req.body.link).trim() !== '') ? String(req.body.link).trim() : 'default';

    // Processamento e normalização de dependentes (se Plano Familiar)
    let rawBeneficiarios = req.body.beneficiarios || req.body.dependentes || [];
    if (typeof rawBeneficiarios === 'string') {
      try {
        rawBeneficiarios = JSON.parse(rawBeneficiarios);
        if (typeof rawBeneficiarios === 'string') rawBeneficiarios = JSON.parse(rawBeneficiarios);
      } catch {
        rawBeneficiarios = [];
      }
    }
    if (!Array.isArray(rawBeneficiarios)) {
      rawBeneficiarios = [];
    }

    const dependentesValidos = [];
    if (isFamiliar) {
      for (let i = 0; i < rawBeneficiarios.length && dependentesValidos.length < 3; i++) {
        const item = rawBeneficiarios[i];
        if (!item) continue;
        const idx = i + 1;

        const nome = String(item.nm_cliente || item[`nm_cliente${idx}`] || '').trim();
        const cpf = String(item.nu_documento || item.cpf || item[`nu_documento${idx}`] || '').replace(/\D/g, "");

        // Pular slots totalmente vazios
        if (!nome && !cpf) continue;

        if (!nome) {
          return res.status(400).json({ success: false, message: `O Dependente 0${idx} precisa ter um nome preenchido.` });
        }
        if (!cpf || cpf.length !== 11) {
          return res.status(400).json({ success: false, message: `CPF inválido para o Dependente 0${idx} (${nome}). Deve conter 11 dígitos.` });
        }
        if (cpf === numericCpfTitular) {
          return res.status(400).json({ success: false, message: `O CPF do Dependente 0${idx} (${nome}) não pode ser idêntico ao CPF do titular.` });
        }
        if (dependentesValidos.some(d => d.nu_documento === cpf)) {
          return res.status(400).json({ success: false, message: `O CPF ${cpf} foi inserido mais de uma vez entre os dependentes.` });
        }

        dependentesValidos.push({
          nm_cliente: nome,
          nu_documento: cpf,
          birthday: String(item.birthday || item[`birthday${idx}`] || defaultBirthday).trim(),
          telefone: telefoneInformado(item.telefone || item[`telefone${idx}`] || req.body.telefone),
          email: String(item.email || item[`email${idx}`] || defaultEmail).trim(),
          zip_code: String(item.zip_code || item.zipCode || item[`zipCode${idx}`] || defaultZipCode).trim(),
          address: String(item.address || item[`address${idx}`] || defaultAddress).trim(),
          city: String(item.city || item[`city${idx}`] || defaultCity).trim(),
          state: String(item.state || item[`state${idx}`] || defaultState).trim(),
        });
      }
    }

    // Pré-validação de CPFs existentes no banco de dados (Titular + Dependentes)
    const todosCpfs = [numericCpfTitular, ...dependentesValidos.map(d => d.nu_documento)];
    const existingRecords = await Clientes.findAll({
      where: {
        nu_documento: { [Op.in]: todosCpfs }
      },
      attributes: ['nu_documento', 'nm_cliente']
    });

    if (existingRecords && existingRecords.length > 0) {
      const primeiroDuplicado = existingRecords[0];
      const papel = (primeiroDuplicado.nu_documento === numericCpfTitular) ? "do titular" : "de dependente";
      return res.status(400).json({
        success: false,
        message: `O CPF ${primeiroDuplicado.nu_documento} (${papel} "${primeiroDuplicado.nm_cliente}") já está cadastrado no sistema.`
      });
    }

    // Montar o JSON de beneficiários no formato padrão do sistema (3 slots)
    const beneficiariosJsonArray = [
      {
        nm_cliente1: dependentesValidos[0]?.nm_cliente || null,
        nu_documento1: dependentesValidos[0]?.nu_documento || null,
        birthday1: dependentesValidos[0]?.birthday || null,
        email1: dependentesValidos[0]?.email || null,
        telefone1: dependentesValidos[0]?.telefone || null,
        zipCode1: dependentesValidos[0]?.zip_code || null,
        address1: dependentesValidos[0]?.address || null,
        city1: dependentesValidos[0]?.city || null,
        state1: dependentesValidos[0]?.state || null,
      },
      {
        nm_cliente2: dependentesValidos[1]?.nm_cliente || null,
        nu_documento2: dependentesValidos[1]?.nu_documento || null,
        birthday2: dependentesValidos[1]?.birthday || null,
        email2: dependentesValidos[1]?.email || null,
        telefone2: dependentesValidos[1]?.telefone || null,
        zipCode2: dependentesValidos[1]?.zip_code || null,
        address2: dependentesValidos[1]?.address || null,
        city2: dependentesValidos[1]?.city || null,
        state2: dependentesValidos[1]?.state || null,
      },
      {
        nm_cliente3: dependentesValidos[2]?.nm_cliente || null,
        nu_documento3: dependentesValidos[2]?.nu_documento || null,
        birthday3: dependentesValidos[2]?.birthday || null,
        email3: dependentesValidos[2]?.email || null,
        telefone3: dependentesValidos[2]?.telefone || null,
        zipCode3: dependentesValidos[2]?.zip_code || null,
        address3: dependentesValidos[2]?.address || null,
        city3: dependentesValidos[2]?.city || null,
        state3: dependentesValidos[2]?.state || null,
      }
    ];

    const emptyBeneficiariosJson = JSON.stringify([
      { nm_cliente1: null, nu_documento1: null, birthday1: null, email1: null, telefone1: null, zipCode1: null, address1: null, city1: null, state1: null },
      { nm_cliente2: null, nu_documento2: null, birthday2: null, email2: null, telefone2: null, zipCode2: null, address2: null, city2: null, state2: null },
      { nm_cliente3: null, nu_documento3: null, birthday3: null, email3: null, telefone3: null, zipCode3: null, address3: null, city3: null, state3: null }
    ]);

    // Transação para criação do titular e dependentes com atomicidade garantida
    const resultado = await sequelize.transaction(async (t) => {
      // 1. Criar Titular
      const titular = await Clientes.create({
        nm_cliente: nmClienteTitular,
        nu_documento: numericCpfTitular,
        birthday: defaultBirthday,
        telefone: telefoneInformado(req.body.telefone),
        email: defaultEmail,
        zip_code: defaultZipCode,
        address: defaultAddress,
        city: defaultCity,
        state: defaultState,
        dt_venda: "default",
        situacao: "Pendente",
        nu_parcelas: "default",
        vl_venda: "default",
        dt_cobranca: "default",
        dt_vencimento: "default",
        dt_pagamento: "default",
        par_atual: "default",
        paymentType: defaultPaymentType,
        serviceType: defaultServiceType,
        link: defaultLink,
        beneficiarios: JSON.stringify(beneficiariosJsonArray),
        id_franqueado: String(idFranqueadoFinal),
        cpf_titular: 'titular',
        cobertura: isFamiliar ? 'familiar' : 'individual'
      }, { transaction: t });

      // 2. Criar Dependentes (se Plano Familiar)
      const dependentesCriados = [];
      if (isFamiliar && dependentesValidos.length > 0) {
        for (const dep of dependentesValidos) {
          const novoDep = await Clientes.create({
            nm_cliente: dep.nm_cliente,
            nu_documento: dep.nu_documento,
            birthday: dep.birthday,
            telefone: dep.telefone,
            email: dep.email,
            zip_code: dep.zip_code,
            address: dep.address,
            city: dep.city,
            state: dep.state,
            dt_venda: "default",
            situacao: "Pendente",
            nu_parcelas: "default",
            vl_venda: "default",
            dt_cobranca: "default",
            dt_vencimento: "default",
            dt_pagamento: "default",
            par_atual: "default",
            paymentType: defaultPaymentType,
            serviceType: defaultServiceType,
            link: "default",
            beneficiarios: emptyBeneficiariosJson,
            id_franqueado: String(idFranqueadoFinal),
            cpf_titular: numericCpfTitular,
            cobertura: 'familiar'
          }, { transaction: t });
          dependentesCriados.push(novoDep);
        }
      }

      return { titular, dependentesCriados };
    });

    const newCliente = resultado.titular;
    const dependentesCriados = resultado.dependentesCriados;

    // Disparos e integrações pós-cadastro (não bloqueantes)
    try {
      if (newCliente && idFranqueadoFinal == 26) {
        await CriarUsuarioAlloyal(newCliente);
      }
    } catch (err) {
      console.warn("Aviso na criação Alloyal: ", err.message);
    }

    try {
      const dataFranqueado = await Franqueado.findOne({
        where: { id: idFranqueadoFinal }
      });

      if (dataFranqueado) {
        const franqueadoData = dataFranqueado.dataValues || dataFranqueado;
        const emaildestino = newCliente.email;
        if (idFranqueadoFinal == 74) {
          await mailerNewCadastroConnectVitta(franqueadoData, emaildestino);
        } else if (franqueadoData.emailModel == 2) {
          await mailerNewCadastroModel2(franqueadoData, emaildestino);
        } else if (franqueadoData.emailModel == 3) {
          await mailerNewCadastroModel3(franqueadoData, emaildestino);
        } else {
          await mailerNewCadastro(franqueadoData, emaildestino);
        }
      }
    } catch (mailErr) {
      console.warn("Aviso ao disparar e-mail de boas-vindas:", mailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: isFamiliar && dependentesCriados.length > 0
        ? `Titular e ${dependentesCriados.length} dependente(s) cadastrados com sucesso!`
        : "Cliente cadastrado com sucesso!",
      cliente: newCliente,
      dependentes: dependentesCriados
    });

  } catch (err) {
    console.error("Erro ao cadastrar cliente:", err);
    const validationMsgs = err.errors?.map(e => e.message).join(' | ');
    return res.status(400).json({ 
      success: false, 
      message: validationMsgs || err.message || "Erro interno ao cadastrar cliente." 
    });
  }
});

// Rota para atualizar dados de clientes e seus dependentes
router.put('/franqueado/clientes/update', async (req, res) => {
  try {
    console.log("Atualização de cliente - body recebido:", req.body);

    const cpfNumber = req.body.nu_documento ? String(req.body.nu_documento).replace(/\D/g, "") : "";
    const cpfOriginal = req.body.documento_original ? String(req.body.documento_original).replace(/\D/g, "") : cpfNumber;

    if (!cpfNumber || cpfNumber.length !== 11) {
      return res.status(400).json({ success: false, message: "CPF inválido (deve conter 11 dígitos numéricos)." });
    }

    const planoCobertura = String(req.body.cobertura || 'individual').toLowerCase().trim();
    const isFamiliar = planoCobertura === 'familiar';

    // Formatar telefone
    const formatarTelefone = (numero) => {
      if (!numero) return '00000000000';
      const limpo = String(numero).replace(/\D/g, '').replace(/^55/, '');
      return limpo.length >= 8 ? limpo : '00000000000';
    };

    const idFranqueadoFinal = req.body.id_franqueado || req.body.idParceiro || req.user?.id;

    const defaultZipCode = (req.body.zip_code && String(req.body.zip_code).trim() !== '') ? String(req.body.zip_code).replace(/\D/g, "") : '00000000';
    const defaultAddress = (req.body.address && String(req.body.address).trim() !== '') ? String(req.body.address).trim() : 'Não informado';
    const defaultCity = (req.body.city && String(req.body.city).trim() !== '') ? String(req.body.city).trim() : 'Não informada';
    const defaultState = (req.body.state && String(req.body.state).trim() !== '') ? String(req.body.state).trim().toUpperCase() : 'SP';
    const defaultBirthday = (req.body.birthday && String(req.body.birthday).trim() !== '') ? String(req.body.birthday).trim() : '01/01/2000';
    const defaultEmail = (req.body.email && String(req.body.email).trim() !== '') ? String(req.body.email).trim() : 'sem-email@oimed.com.br';
    const defaultPaymentType = (req.body.paymentType && String(req.body.paymentType).trim() !== '') ? String(req.body.paymentType).trim() : 'S';
    const defaultServiceType = (req.body.serviceType && String(req.body.serviceType).trim() !== '') ? String(req.body.serviceType).trim() : 'GSP';
    const defaultLink = (req.body.link && String(req.body.link).trim() !== '') ? String(req.body.link).trim() : 'default';

    // Normalizar dependentes recebidos (se plano familiar)
    let rawBeneficiarios = req.body.beneficiarios || req.body.dependentes || [];
    if (typeof rawBeneficiarios === 'string') {
      try {
        rawBeneficiarios = JSON.parse(rawBeneficiarios);
        if (typeof rawBeneficiarios === 'string') rawBeneficiarios = JSON.parse(rawBeneficiarios);
      } catch {
        rawBeneficiarios = [];
      }
    }
    if (!Array.isArray(rawBeneficiarios)) {
      rawBeneficiarios = [];
    }

    const dependentesValidos = [];
    if (isFamiliar) {
      for (let i = 0; i < rawBeneficiarios.length && dependentesValidos.length < 3; i++) {
        const item = rawBeneficiarios[i];
        if (!item) continue;
        const idx = i + 1;

        const nome = String(item.nm_cliente || item[`nm_cliente${idx}`] || '').trim();
        const cpf = String(item.nu_documento || item.cpf || item[`nu_documento${idx}`] || '').replace(/\D/g, "");

        if (!nome && !cpf) continue;

        if (!nome) {
          return res.status(400).json({ success: false, message: `O Dependente 0${idx} precisa ter um nome preenchido.` });
        }
        if (!cpf || cpf.length !== 11) {
          return res.status(400).json({ success: false, message: `CPF inválido para o Dependente 0${idx} (${nome}). Deve conter 11 dígitos.` });
        }
        if (cpf === cpfNumber) {
          return res.status(400).json({ success: false, message: `O CPF do Dependente 0${idx} (${nome}) não pode ser idêntico ao CPF do titular.` });
        }
        if (dependentesValidos.some(d => d.nu_documento === cpf)) {
          return res.status(400).json({ success: false, message: `O CPF ${cpf} foi inserido mais de uma vez entre os dependentes.` });
        }

        dependentesValidos.push({
          nm_cliente: nome,
          nu_documento: cpf,
          birthday: String(item.birthday || item[`birthday${idx}`] || defaultBirthday).trim(),
          telefone: formatarTelefone(item.telefone || item[`telefone${idx}`] || req.body.telefone),
          email: String(item.email || item[`email${idx}`] || defaultEmail).trim(),
          zip_code: String(item.zip_code || item.zipCode || item[`zipCode${idx}`] || defaultZipCode).replace(/\D/g, ""),
          address: String(item.address || item[`address${idx}`] || defaultAddress).trim(),
          city: String(item.city || item[`city${idx}`] || defaultCity).trim(),
          state: String(item.state || item[`state${idx}`] || defaultState).trim().toUpperCase(),
        });
      }
    }

    // Montar o JSON de beneficiários no formato padrão do sistema (3 slots)
    const beneficiariosJsonArray = [
      {
        nm_cliente1: dependentesValidos[0]?.nm_cliente || null,
        nu_documento1: dependentesValidos[0]?.nu_documento || null,
        birthday1: dependentesValidos[0]?.birthday || null,
        email1: dependentesValidos[0]?.email || null,
        telefone1: dependentesValidos[0]?.telefone || null,
        zipCode1: dependentesValidos[0]?.zip_code || null,
        address1: dependentesValidos[0]?.address || null,
        city1: dependentesValidos[0]?.city || null,
        state1: dependentesValidos[0]?.state || null,
      },
      {
        nm_cliente2: dependentesValidos[1]?.nm_cliente || null,
        nu_documento2: dependentesValidos[1]?.nu_documento || null,
        birthday2: dependentesValidos[1]?.birthday || null,
        email2: dependentesValidos[1]?.email || null,
        telefone2: dependentesValidos[1]?.telefone || null,
        zipCode2: dependentesValidos[1]?.zip_code || null,
        address2: dependentesValidos[1]?.address || null,
        city2: dependentesValidos[1]?.city || null,
        state2: dependentesValidos[1]?.state || null,
      },
      {
        nm_cliente3: dependentesValidos[2]?.nm_cliente || null,
        nu_documento3: dependentesValidos[2]?.nu_documento || null,
        birthday3: dependentesValidos[2]?.birthday || null,
        email3: dependentesValidos[2]?.email || null,
        telefone3: dependentesValidos[2]?.telefone || null,
        zipCode3: dependentesValidos[2]?.zip_code || null,
        address3: dependentesValidos[2]?.address || null,
        city3: dependentesValidos[2]?.city || null,
        state3: dependentesValidos[2]?.state || null,
      }
    ];

    const updateData = {
      nm_cliente: req.body.nm_cliente ? String(req.body.nm_cliente).trim() : undefined,
      nu_documento: cpfNumber,
      birthday: defaultBirthday,
      telefone: formatarTelefone(req.body.telefone),
      email: defaultEmail,
      zip_code: defaultZipCode,
      address: defaultAddress,
      city: defaultCity,
      state: defaultState,
      paymentType: defaultPaymentType,
      serviceType: defaultServiceType,
      cobertura: planoCobertura,
      link: defaultLink,
      beneficiarios: JSON.stringify(beneficiariosJsonArray),
    };

    if (idFranqueadoFinal) {
      updateData.id_franqueado = String(idFranqueadoFinal);
    }

    // Remove chaves undefined
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    // Atualizar titular
    await Clientes.update(updateData, {
      where: {
        [Op.or]: [
          { nu_documento: cpfOriginal },
          { nu_documento: cpfNumber },
        ]
      }
    });

    // Se o CPF do titular mudou, atualizar referências nos dependentes existentes
    if (cpfOriginal && cpfOriginal !== cpfNumber) {
      await Clientes.update({ cpf_titular: cpfNumber }, {
        where: { cpf_titular: cpfOriginal }
      });
    }

    // Sincronizar dependentes
    const cpfsTitularFiltro = [cpfOriginal, cpfNumber].filter(Boolean);

    if (isFamiliar) {
      const dependentesCpfs = dependentesValidos.map(d => d.nu_documento);

      // 1. Remover dependentes vinculados ao titular que não estão mais na lista enviada
      await Clientes.destroy({
        where: {
          cpf_titular: { [Op.in]: cpfsTitularFiltro },
          nu_documento: { [Op.notIn]: dependentesCpfs.length > 0 ? dependentesCpfs : ['__none__'] }
        }
      });

      // 2. Atualizar ou criar cada dependente válido
      const arrayDefault = JSON.stringify(beneficiariosJsonArray);
      for (const dep of dependentesValidos) {
        const existingDep = await Clientes.findOne({
          where: { nu_documento: dep.nu_documento }
        });

        if (existingDep) {
          await Clientes.update({
            nm_cliente: dep.nm_cliente,
            birthday: dep.birthday,
            telefone: dep.telefone,
            email: dep.email,
            zip_code: dep.zip_code,
            address: dep.address,
            city: dep.city,
            state: dep.state,
            paymentType: defaultPaymentType,
            serviceType: defaultServiceType,
            cobertura: 'familiar',
            cpf_titular: cpfNumber,
          }, {
            where: { nu_documento: dep.nu_documento }
          });
        } else {
          await Clientes.create({
            nm_cliente: dep.nm_cliente,
            nu_documento: dep.nu_documento,
            birthday: dep.birthday,
            telefone: dep.telefone,
            email: dep.email,
            zip_code: dep.zip_code,
            address: dep.address,
            city: dep.city,
            state: dep.state,
            dt_venda: "default",
            situacao: "Pendente",
            nu_parcelas: "default",
            vl_venda: "default",
            dt_cobranca: "default",
            dt_vencimento: "default",
            dt_pagamento: "default",
            par_atual: "default",
            paymentType: defaultPaymentType,
            serviceType: defaultServiceType,
            cobertura: 'familiar',
            link: "default",
            beneficiarios: arrayDefault,
            id_franqueado: idFranqueadoFinal || '0',
            cpf_titular: cpfNumber
          });
        }
      }
    } else {
      // Plano Individual: remover dependentes que estavam vinculados a este titular
      await Clientes.destroy({
        where: {
          cpf_titular: { [Op.in]: cpfsTitularFiltro }
        }
      });
    }

    return res.json({
      success: true,
      message: "Dados do cliente e plano atualizados com sucesso!"
    });
  } catch (err) {
    console.error("Erro ao atualizar cliente:", err);
    return res.status(400).json({
      success: false,
      message: err.message || "Erro ao atualizar dados do cliente."
    });
  }
});

//mudar isso de lugar, temporario
router.put('/subfranqueado/clientes/update', async (req, res) => {
  try {


    console.log("request de atualização", req.body);


    var cpfNumber = req.body.nu_documento;
    var numericCpfNumber = cpfNumber.replace(/\D/g, "");

    var cpfOriginal = req.body.documento_original;
    var numericCpfOriginal = cpfOriginal.replace(/\D/g, "");

    //console.log(numericCpfNumber);

    const idSubFranqueado = await SubClientes.findOne({
      where: {
        nu_documento: numericCpfNumber
      },
      raw: true,
      attributes: ['id_franqueado']
    });

    console.log("idSubFranqueado", idSubFranqueado);

    const newCliente = await SubClientes.update({
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
      id_franqueado: idSubFranqueado.id_franqueado,
      //cpf_titular: "titular"
    }, {
      where: {
        [Op.or]: [
          { nu_documento: numericCpfOriginal },
          { nu_documento: cpfOriginal },
          { nu_documento: cpfNumber },
          { nu_documento: numericCpfNumber },
        ]
      }
    });



    console.log("mycliente", {
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
      id_franqueado: idSubFranqueado.id_franqueado,
      //cpf_titular: "titular"
    })

    try {
      const selectCobertura = await Clientes.update({
        cobertura: req.body.cobertura,
      }, {
        where: {
          [Op.or]: [
            { nu_documento: numericCpfNumber },
            { cpf_titular: numericCpfNumber }
          ]
        }
      });
      criarDependenteGeral()
    } catch (err) {
      console.log("Erro ao atualizar cliente:", err);
    }



    async function criarDependenteGeral() {
      const arrayDefault = '[{"nm_cliente1":null,"nu_documento1":null,"birthday1":null,"email1":null,"telefone1":null,"zipCode1":null,"address1":null,"city1":null,"state1":null},{"nm_cliente2":null,"nu_documento2":null,"birthday2":null,"email2":null,"telefone2":null,"zipCode2":null,"address2":null,"city2":null,"state2":null},{"nm_cliente3":null,"nu_documento3":null,"birthday3":null,"email3":null,"telefone3":null,"zipCode3":null,"address3":null,"city3":null,"state3":null}]';

      let userExiste = false;

      for (let i = 0; i < req.body.beneficiarios.length; i++) {

        const beneficiario = req.body.beneficiarios[i];
        const contador = i + 1;

        const cpf = beneficiario["nu_documento" + contador];

        if (!cpf) continue;

        const numericCpfNumber = cpf.replace(/\D/g, "");

        const existingCliente = await Clientes.findOne({
          where: { nu_documento: numericCpfNumber }
        });

        // 🚨 Se já existir, retorna imediatamente
        if (existingCliente) {
          continue;
          /*        return res.status(200).json({
                   success: false,
                   message: `Cliente com CPF ${numericCpfNumber} já cadastrado`
                 }); */
        }

        if (beneficiario["nm_cliente" + contador]) {

          await Clientes.create({
            nm_cliente: beneficiario["nm_cliente" + contador],
            nu_documento: numericCpfNumber,
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
            cobertura: req.body.cobertura,
            link: "default",
            beneficiarios: arrayDefault,
            id_franqueado: req.body.id_franqueado,
            cpf_titular: req.body.nu_documento
          });

        }
      }

      return res.json({
        success: true,
        message: "Atualizado com sucesso"
      });


      // if (newCliente) {
      /*  let userExiste = false;
 
       req.body.beneficiarios.map(async (beneficiario, i) => {
         var contador = i + 1;
 
         if (!beneficiario["nu_documento" + contador]) {
           console.log("debug: ", beneficiario["nu_documento" + contador])
           return;
         }
 
         var cpfNumber = beneficiario["nu_documento" + contador];
         var numericCpfNumber = cpfNumber.replace(/\D/g, "");
 
         const existingCliente = await Clientes.findOne({
           where: {
             nu_documento: numericCpfNumber
           }
         });
 
         if (existingCliente) {
           userExiste = true;
           return;
           //return res.status(400).json({ success: false, message: "Cliente já cadastrado" });
         }
 
 
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
               cobertura: req.body.cobertura,
               link: "default",
               beneficiarios: arrayDefault,
               id_franqueado: req.body.id_franqueado,
               cpf_titular: req.body.nu_documento
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
               cobertura: req.body.cobertura,
               link: "default",
               beneficiarios: arrayDefault,
               id_franqueado: req.body.id_franqueado,
               cpf_titular: req.body.nu_documento
             }, {
               where: {
                 nu_documento: beneficiario["nu_documento" + contador]
               }
             });
           }
 
         }
 
       });
 
       if (userExiste) {
         console.log(userExiste)
         return res.status(400).json({ success: false, message: "Cliente já cadastrado" });
       } else {
         res.json({ success: true, message: "atualizado com sucesso" });
 
       } */

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

  if (req.body.categoria != 'link.sucesso') {
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
    if (venda) {
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

      console.log("ver ess aqyui: ", objetoDoMesAtual)

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
  let idFranqueado = req.body.idFranqueado;

  const verificarFranqueado = await Franqueado.findOne({
    where: {
      id: idFranqueado
    }
  });

  if (!verificarFranqueado) {
    idFranqueado = req.body.id;
  } else {
    idFranqueado = req.body.idFranqueado;
  }

  try {
    /*   const situacaoAtual = await Clientes.findAll({
        where: {
          situacao: statusParam,
          id_franqueado: req.body.id
        }
      }); */

    const situacaoAtual = await Clientes.findAll({
      where: {
        situacao: statusParam,
        id_franqueado: idFranqueado
      },
      include: [{
        model: Sleeping,
        required: false
      }],
      order: [
        // COALESCE(NULLIF(cpf_titular, 'titular'), nu_documento) ASC
        [literal(`COALESCE(NULLIF(cpf_titular, 'titular'), nu_documento)`), 'ASC'],

        // CASE WHEN cpf_titular = 'titular' THEN 0 ELSE 1 END ASC
        [literal(`CASE WHEN cpf_titular = 'titular' THEN 0 ELSE 1 END`), 'ASC'],

        // nu_documento ASC
        ['nu_documento', 'ASC']
      ]
    });

    res.json(situacaoAtual);
  }
  catch (err) {
    console.log(err)
    res.json({ success: false, message: "Franqueado não encotrado!" })
  }


});

router.post('/cliente/filter/plan/:plan', async (req, res) => {
  let statusParam = req.params.plan;
  try {

    if (statusParam === "individual") {
      const situacaoAtual = await Clientes.findAll({
        where: {
          cobertura: statusParam,
          id_franqueado: req.body.id
        }
      });
      res.json(situacaoAtual);
    } else {
      const situacaoAtual = await Clientes.findAll({
        where: {
          cobertura: statusParam,
          id_franqueado: req.body.id
        },
        order: [
          // COALESCE(NULLIF(cpf_titular, 'titular'), nu_documento) ASC
          [literal(`COALESCE(NULLIF(cpf_titular, 'titular'), nu_documento)`), 'ASC'],

          // CASE WHEN cpf_titular = 'titular' THEN 0 ELSE 1 END ASC
          [literal(`CASE WHEN cpf_titular = 'titular' THEN 0 ELSE 1 END`), 'ASC'],

          // nu_documento ASC
          ['nu_documento', 'ASC']
        ]
      });
      res.json(situacaoAtual);
    }


  }
  catch (err) {
    res.json({ success: false, message: "Franqueado não encotrado!" })
  }


});

//buscar lista de franqueados
router.get('/franqueado/list', async (req, res) => {
  const isAdmin = req.user && (req.user.autoridade === 1 || req.user.perfil === 'master');

  const queryOptions = {
    include: [{
      model: relacPlanos,
      as: 'planos'
    }]
  };

  // SEGURANÇA: Se não for Administrador Master, só pode listar o seu próprio registro
  if (!isAdmin) {
    queryOptions.where = { id: req.user.id };
  }

  const linkFranqueado = await Franqueado.findAll(queryOptions);
  countClients();

  res.json(linkFranqueado);
});

//buscar franqueados unico
router.post('/franqueado/listunique', async (req, res) => {
  const isAdmin = req.user && (req.user.autoridade === 1 || req.user.perfil === 'master');

  const whereClause = {
    nome: {
      [Op.like]: `${req.body.cpf}%`
    }
  };

  if (!isAdmin) {
    whereClause.id = req.user.id;
  }

  const linkFranqueado = await Franqueado.findAll({
    where: whereClause
  });

  res.json(linkFranqueado);
});

// Atributos seguros e necessários para operações da tela de Clientes (remove campos mortos/lixo do banco)
const CLIENT_SAFE_ATTRIBUTES = [
  'id',
  'nm_cliente',
  'nu_documento',
  'birthday',
  'telefone',
  'email',
  'zip_code',
  'address',
  'city',
  'state',
  'paymentType',
  'serviceType',
  'situacao',
  'cobertura',
  'cpf_titular',
  'beneficiarios',
  'id_franqueado',
  'dtAtivacao',
  'dtDesativacao',
  'createdAt',
  'updatedAt'
];

const SUBCLIENT_SAFE_ATTRIBUTES = [
  'id',
  'nm_cliente',
  'nu_documento',
  'birthday',
  'telefone',
  'email',
  'zip_code',
  'address',
  'city',
  'state',
  'paymentType',
  'serviceType',
  'situacao',
  'cpf_titular',
  'beneficiarios',
  'id_franqueado',
  'dtAtivacao',
  'dtDesativacao',
  'createdAt',
  'updatedAt'
];

//buscar lista de clientes para agendamento
router.post('/franqueado/clientes/list/agenda', async (req, res) => {
  const isAdmin = req.user && (req.user.autoridade === 1 || req.user.perfil === 'master');
  const isFilterAll = !req.body.id || req.body.id === 'todos' || req.body.id === 'all' || req.body.id === 'null' || req.body.id === 'undefined';
  const targetId = isAdmin ? (isFilterAll ? null : req.body.id) : req.user.id;
  const whereCondition = targetId ? { id_franqueado: targetId } : {};

  const isSubpainel = (
    req.body.isSubPainelConsulta === true || 
    (Boolean(req.body.subpainel) && req.query.subList && req.query.subList !== "null" && req.query.subList !== "undefined" && req.query.subList !== "")
  );

  if (isSubpainel) {
    const nmClientes = await SubClientes.findAll({
      attributes: SUBCLIENT_SAFE_ATTRIBUTES,
      where: whereCondition
    });

    return res.json({ success: true, message: nmClientes });
  }

  const nmClientes = await Clientes.findAll({
    attributes: CLIENT_SAFE_ATTRIBUTES,
    where: whereCondition,
    include: [
      {
        model: Franqueado,
        attributes: ['id', 'nome'],
        required: false
      },
      {
        model: Sleeping,
        required: false,
        attributes: ['id', 'idVida', 'uuid']
      }
    ],
    order: [
      [literal(`COALESCE(NULLIF(cpf_titular, 'titular'), nu_documento)`), 'ASC'],
      [literal(`CASE WHEN cpf_titular = 'titular' THEN 0 ELSE 1 END`), 'ASC'],
      ['nu_documento', 'ASC']
    ]
  });

  return res.json({ success: true, message: nmClientes });
});

//buscar lista de clientes
router.post('/franqueado/clientes/list', async (req, res) => {
  const isAdmin = req.user && (req.user.autoridade === 1 || req.user.perfil === 'master');
  // Se for admin, pode escolher um parceiro específico OU listar todos ('todos', 'all', ou null/vazio)
  const isFilterAll = !req.body.id || req.body.id === 'todos' || req.body.id === 'all' || req.body.id === 'null' || req.body.id === 'undefined';
  const targetId = isAdmin ? (isFilterAll ? null : req.body.id) : req.user.id;
  const whereCondition = targetId ? { id_franqueado: targetId } : {};

  const isSubpainel = (
    req.body.isSubPainelConsulta === true || 
    (Boolean(req.body.subpainel) && req.query.subList && req.query.subList !== "null" && req.query.subList !== "undefined" && req.query.subList !== "")
  );

  if (isSubpainel) {
    const nmClientes = await SubClientes.findAll({
      attributes: SUBCLIENT_SAFE_ATTRIBUTES,
      where: whereCondition
    });

    return res.json({ success: true, message: nmClientes });
  }

  const nmClientes = await Clientes.findAll({
    attributes: CLIENT_SAFE_ATTRIBUTES,
    where: whereCondition,
    include: [
      {
        model: Franqueado,
        attributes: ['id', 'nome'],
        required: false
      },
      {
        model: Sleeping,
        required: false,
        attributes: ['id', 'idVida', 'uuid']
      }
    ],
    order: [
      [literal(`COALESCE(NULLIF(cpf_titular, 'titular'), nu_documento)`), 'ASC'],
      [literal(`CASE WHEN cpf_titular = 'titular' THEN 0 ELSE 1 END`), 'ASC'],
      ['nu_documento', 'ASC']
    ]
  });

  return res.json(nmClientes);
});

//atualizar franqueados
router.get('/franqueado/update/:id', async (req, res) => {
  Franqueado.destroy({ where: { id: req.params.id } })
  res.json('deletado');
});

// Alternar modo Sleeping (colocar em hibernação ou despertar)
router.put('/cliente/toggleSleeping/:uuid', async (req, res) => {
  try {
    const docOrUuid = req.params.uuid;
    const cleanDoc = String(docOrUuid).replace(/\D/g, '');

    const isSleeping = await Sleeping.findOne({
      where: {
        [Op.or]: [
          { idVida: cleanDoc },
          { idVida: docOrUuid },
          { uuid: docOrUuid }
        ]
      }
    });

    if (isSleeping) {
      const targetUuid = isSleeping.uuid || docOrUuid;
      try {
        if (targetUuid && targetUuid.includes('-')) {
          await dormir.update(targetUuid);
        }
      } catch (apiErr) {
        console.warn("Aviso ao reativar beneficiário na Rapidoc:", apiErr.message);
      }

      await Sleeping.destroy({
        where: {
          [Op.or]: [
            { idVida: cleanDoc },
            { idVida: docOrUuid },
            { uuid: targetUuid }
          ]
        }
      });

      return res.status(200).json({ 
        success: true, 
        action: 'wakeup', 
        message: "Beneficiário despertado do Sleeping com sucesso!" 
      });
    } else {
      const cliente = await Clientes.findOne({
        where: {
          [Op.or]: [
            { nu_documento: cleanDoc },
            { nu_documento: docOrUuid }
          ]
        }
      });

      let beneficiaryUuid = cliente?.uuid || null;

      try {
        const resultado = await dormir.delete(cleanDoc);
        if (resultado && resultado.beneficiary && resultado.beneficiary.uuid) {
          beneficiaryUuid = resultado.beneficiary.uuid;
        }
      } catch (apiErr) {
        console.warn("Aviso ao inativar na telemedicina:", apiErr.message);
      }

      if (beneficiaryUuid && cliente && !cliente.uuid) {
        await Clientes.update({ uuid: beneficiaryUuid }, { where: { id: cliente.id } }).catch(() => {});
      }

      await Sleeping.findOrCreate({
        where: { idVida: cleanDoc },
        defaults: {
          idVida: cleanDoc,
          uuid: beneficiaryUuid || 'sleeping_' + Date.now()
        }
      });

      return res.status(200).json({ 
        success: true, 
        action: 'sleep', 
        message: "Beneficiário colocado em modo Sleeping com sucesso!" 
      });
    }
  } catch (err) {
    console.error("Erro no toggleSleeping:", err);
    return res.status(500).json({ success: false, message: "Erro ao alternar modo Sleeping: " + err.message });
  }
});


//buscar cliente por id
router.get('/buscar/cliente/:id', async (req, res) => {
  if (!req.params.id) {
    res.json({ success: false, message: "erro no identificador" });
    return;
  }

  const isAdmin = req.user && (req.user.autoridade === 1 || req.user.perfil === 'master');
  const partnerWhere = isAdmin ? { id: req.params.id } : { id: req.params.id, id_franqueado: req.user.id };

  if (req.query.subpainel === "true") {
    const cliente = await SubClientes.findAll({
      attributes: SUBCLIENT_SAFE_ATTRIBUTES,
      where: partnerWhere
    });

    if (!cliente || cliente.length === 0) {
      return res.status(404).json({ success: false, message: "Cliente não encontrado ou sem permissão" });
    }

    const dependentes = await SubClientes.findAll({
      attributes: SUBCLIENT_SAFE_ATTRIBUTES,
      where: {
        cpf_titular: cliente[0].dataValues.nu_documento
      }
    });

    res.json({ success: true, message: cliente, dependentes: dependentes })
  } else {
    const cliente = await Clientes.findAll({
      attributes: CLIENT_SAFE_ATTRIBUTES,
      where: partnerWhere
    });

    if (!cliente || cliente.length === 0) {
      return res.status(404).json({ success: false, message: "Cliente não encontrado ou sem permissão" });
    }

    const dependentes = await Clientes.findAll({
      attributes: CLIENT_SAFE_ATTRIBUTES,
      where: {
        cpf_titular: cliente[0].dataValues.nu_documento
      }
    });

    res.json({ success: true, message: cliente, dependentes: dependentes })
  }
});


//buscar cliente por franqueado
router.get('/clientes/list', async (req, res) => {
  const isAdmin = req.user && (req.user.autoridade === 1 || req.user.perfil === 'master');
  const whereClause = isAdmin ? { link: req.body.link } : { link: req.body.link, id_franqueado: req.user.id };
  const nmClientes = await Clientes.findAll({
    attributes: CLIENT_SAFE_ATTRIBUTES,
    where: whereClause
  });

  res.send(nmClientes)

});

//buscar cliente
/* router.post('/clientes/seacrh/list', async (req, res) => {
  const { id, nu_documento } = req.body;

  if (id == 2 || id == 125) {
    const nmClientes = await Clientes.findAll({
      where: {
        [Op.or]: [
          { id_franqueado: { [Op.like]: `${nu_documento}` } },
          { nm_cliente: { [Op.like]: `${nu_documento}%` } },
          { nu_documento: { [Op.like]: `${nu_documento}%` } }  
        ]
      },
      include: [{
        model: Sleeping,
        required: false // true = INNER JOIN / false = LEFT JOIN
      }]
    });

    if (nmClientes.length > 0) {
      return res.json(nmClientes)
    } else {
      return res.json({ "success": false, "message": "Cliente não encontrado.." });
    }
  }

  const nmClientes = await Clientes.findAll({
    where: {

      [Op.or]: [
        { nm_cliente: { [Op.like]: `${nu_documento}%` } },
        { nu_documento: { [Op.like]: `%${nu_documento}%` } }
      ], // req.body.nu_documento
      id_franqueado: id
    }
  });

  if (nmClientes) {
    res.json(nmClientes)
  } else {
    res.json({ "success": false, "message": "usuário não encontrado.." });
  }


});
 */

// buscar cliente
router.post('/clientes/seacrh/list', async (req, res) => {
  try {
    const { id, nu_documento } = req.body;

    // PERFIS ESPECIAIS
    if (id == 2 || id == 125) {

      // 1️⃣ PRIMEIRO: tenta pelo id_franqueado
      let nmClientes = await Clientes.findAll({
        where: {
          id_franqueado: nu_documento
        },
        include: [{
          model: Sleeping,
          required: false
        }]
      });

      // 2️⃣ SE NÃO ENCONTRAR, tenta por nome ou documento
      if (nmClientes.length === 0) {
        nmClientes = await Clientes.findAll({
          where: {
            [Op.or]: [
              { nm_cliente: { [Op.like]: `${nu_documento}%` } },
              { nu_documento: { [Op.like]: `${nu_documento}%` } }
            ]
          },
          include: [{
            model: Sleeping,
            required: false
          }]
        });
      }

      if (nmClientes.length > 0) {
        return res.json(nmClientes);
      }

      return res.json({
        success: false,
        message: "Cliente não encontrado."
      });
    }

    // PERFIS NORMAIS
    const nmClientes = await Clientes.findAll({
      where: {
        id_franqueado: id,
        [Op.or]: [
          { nm_cliente: { [Op.like]: `${nu_documento}%` } },
          { nu_documento: { [Op.like]: `%${nu_documento}%` } }
        ]
      }
    });

    if (nmClientes.length > 0) {
      return res.json(nmClientes);
    }

    return res.json({
      success: false,
      message: "Usuário não encontrado."
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Erro interno no servidor."
    });
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

//apagar franqueado (exclusivo admin)
router.delete('/franqueado/:id', adminAuth, async (req, res) => {
  await Franqueado.destroy({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Franqueado excluído com sucesso.' });
});

//apagar cliente (com validação de carteira)
router.delete('/franqueado/cliente/:id', async (req, res) => {
  const isAdmin = req.user && (req.user.autoridade === 1 || req.user.perfil === 'master');
  const whereClause = { id: req.params.id };

  // Se não for admin, só pode excluir cliente da sua própria carteira
  if (!isAdmin) {
    whereClause.id_franqueado = req.user.id;
  }

  const deleted = await Clientes.destroy({ where: whereClause });
  if (deleted) {
    res.json({ success: true, message: 'Cliente excluído com sucesso.' });
  } else {
    res.status(404).json({ success: false, message: 'Cliente não encontrado ou não pertence a este franqueado.' });
  }
});

//rota de testes para mudar situação do cliente
router.put('/franqueado/cliente/status', async (req, res) => {
  try {
    const cliente = await Clientes.update({
      situacao: req.body.situacao,
    }, {
      where: {
        [Op.or]: [
          { id: req.body.id },
          { nu_documento: req.body.id },
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

//rota de testes para mudar situação do cliente no subpainel
router.put('/subpainel/franqueado/cliente/status', async (req, res) => {
  try {
    const cliente = await SubClientes.update({
      situacao: req.body.situacao,
    }, {
      where: {
        [Op.or]: [
          { id: req.body.id },
          { nu_documento: req.body.id },
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
    //await InativaUsuarioAlloyal(cpf);
  } catch (err) {
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


    if (response.data.success == false) {
      console.log(response.data)
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


      try {
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
      } catch (err) {
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

  const idFranqueado = await Clientes.findOne({
    where: {
      nu_documento: cpfinformed
    },
    raw: true
  });

  if (idFranqueado.id_franqueado == 26) {
    try {
      await AtivaUsuarioAlloyal(cpfinformed);
    } catch (err) {
      console.log("erro reativar aloyal 1660", err.message)
    }
  }


  try {

    const uuidGet = await Rapidoc.findAll({
      where: {
        cpf: cpfinformed
      }
    })

    console.log(uuidGet, cpfinformed)
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
  } catch (err) {
    console.log("caminho do erro: Routes.js linha 1679 reativação")
    console.log("erro do reactivate: ", err)
  }
});

///ativar vida manualmente via painel oimed
router.post('/beneficiaries/create/:cpf', async (req, res) => {
  const cpf = req.params.cpf;
  console.log("req.body", req.params)

  if (req.body == 1) {

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

    const birthdayFormat = dataVerify ? modifieData1() : modifieData2; //formatar data para 0000-00-00

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


  //console.log('manutenção', serviceVerification(cliente[0].serviceType))
  function serviceVerification(serviceType) {
    if (serviceType === 'GS' || serviceType === 'GSP') {
      return 'G';
    } else {
      return serviceType;
    };
  }


  if (cliente.length < 1) {
    console.log("cliente não encontrado na base de dados")
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

  const birthdayFormat = dataVerify ? modifieData1() : modifieData2; //formatar data para 0000-00-00

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
      "state": cliente[0].state.length <= 2 ? cliente[0].state : cliente[0].state.substr(cliente[0].state.length - 3, 2),
      "paymentType": cliente[0].paymentType,
      "serviceType": serviceVerification(cliente[0].serviceType),
      "holder": cliente[0].cpf_titular === 'titular' ? "" : cliente[0].cpf_titular,
      "general": cliente[0].id_franqueado
    }
  ];





  //console.log("clientessssssssssssssss", cliente[0])
  const dataArr = JSON.parse(cliente[0].beneficiarios);
  //console.log("debug: ", dataArr)
  //console.log(dataArr[0].birthday1)
  //try {

  if (dataArr.length > 0) {
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
        "state": dataArr[0].state1.length <= 2 ? dataArr[0].state1 : dataArr[0].state1.substr(dataArr[0].state1.length - 3, 2),
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
        "state": dataArr[0].state2.length <= 2 ? dataArr[0].state2 : dataArr[0].state2.substr(dataArr[0].state2.length - 3, 2),
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
        "state": dataArr[0].state3.length <= 2 ? dataArr[0].state3 : dataArr[0].state3.substr(dataArr[0].state3.length - 3, 2),
        "holder": cliente[0].nu_documento
      };

      arrBD.push(dep3);
    }
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


      const clienteUpdate = await Clientes.update({
        dtAtivacao: new Date()
      }, {
        where: { nu_documento: cpf }
      });

      //resposta para o cliente
      res.send(response.data);
      console.log(response.data)
      console.log("criado: ", response.data);
      const dataFranqueado = await Franqueado.findAll({
        where: {
          id: cliente[0].dataValues.id_franqueado
        }
      });


      await mailerNewCadastro(dataFranqueado[0].dataValues, cliente[0].dataValues.email);

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
    console.log("caminho do erro: Routes.js linha 1166", err)
    res.json(err.message);
    res.status(400);
    let sending = await sendMailError(arrBD, "Vida não cadastrada na Central principal", err.data, cliente[0].id_franqueado, "PENDENTE");
    console.log("caminho do erro: Routes.js linha 1166", err.message)
  }
});

router.post('/subpainel/beneficiaries/create/:cpf', async (req, res) => {
  const cpf = req.params.cpf;
  console.log("req.body", req.params);

  try {
    const result = await ativarBeneficiarioSubpainel(cpf, req.body);
    if (result.data) {
      return res.send(result.data);
    }
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.log("caminho do erro: Routes.js linha 1166", err);
    return res.status(400).json(err.message);
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
  const eventType = req.body.event;


  if (eventType === 'PAYMENT_CONFIRMED' || eventType === 'PAYMENT_RECEIVED') {
    const token = await Franqueado.findAll({
      where: {
        id: parceiroID
      }
    });

    webhookActivate(req.body, token[0].tokenAsaas, res);

  } else if (eventType === "PAYMENT_OVERDUE") {
    const token = await Franqueado.findAll({
      where: {
        id: parceiroID
      }
    });


    webhookInactivate(req.body, token[0].tokenAsaas, res);
  } else {
    res.json({ success: true, message: "ok" })
  }

});

//WEBHOOKS
//router.get('/webhook/subscription', );




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
  franqueados.forEach(async (franqueado) => {


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
    }, {
      where: {
        cpf: franqueado.cpf
      }
    })

  });

}

//Payment reminder
router.get('/payment/reminder/7', paymentReminder.paymentReminder7);
router.get('/payment/reminder/1', paymentReminder.paymentReminder1);

//SUBPAINEIS
router.post('/subpainel/create', sub_franqueados.create);
router.get('/subpainel/read/:id', sub_franqueados.read);
router.put('/subpainel/update/:id', sub_franqueados.update);
router.delete('/subpainel/delete/:id', sub_franqueados.delete);
router.get('/subpainel/clientes/:id', sub_franqueados.getClientes);
router.post('/subpainel/create/clientes', sub_franqueados.createClientes);
router.post('/subpainel/import/clientes', upload.single('file'), sub_franqueados.importClientes);

//ORDERs YAMPI
router.get('/conectamed/order/:cpf', yampi.listOrder);
router.post('/conectamed/notification', yampi.webhook);

//FATURAMENTO
router.get('/list/parceiros', faturamento.listParceiros);
router.get('/list/clientes/:id', faturamento.listDados);
router.get('/faturamento/parceiros', faturamento.listParceiros);
router.get('/faturamento/dados/:id', faturamento.listDados);
router.get('/faturamento/historico/:id', faturamento.getHistorico);
router.post('/faturamento/fechar', faturamento.fecharFatura);
router.patch('/faturamento/:id/status', faturamento.atualizarStatus);
router.get('/faturamento/planos/:id', faturamento.getPlanos);
router.put('/faturamento/planos/:id', faturamento.salvarPlanos);
router.get('/faturamento/vidas/:id', faturamento.getVidasAuditoria);



//envioEmMassaTeste()

async function envioEmMassaTeste() {
  //const arr = [5004, 5008, 5009, 5019]

  const emailsUsers = await Clientes.findAll({
    where: {
      id_franqueado: 94
      //id: [5801, 5803, 5804, 5792, 5793, 5794, 5795]
      //id: 6087
    },
    attributes: ['email', 'id_franqueado'],
    raw: true
  });


  console.log("emailsUsers: ", emailsUsers)

  emailsUsers.map(async (idFranqueado) => {

    const dataFranqueado = await Franqueado.findAll({
      where: {
        id: idFranqueado.id_franqueado
      }
    });

    //console.log("idFranqueado: ", dataFranqueado[0].dataValues, idFranqueado.email);
    await mailerNewCadastro(dataFranqueado[0].dataValues, idFranqueado.email);
  })
  /*   
  
      if (idFranqueado == 74) {
        let sending = await mailerNewCadastroConnectVitta(dataFranqueado[0].dataValues, emaildestino);
      } else {
        let sending = await mailerNewCadastro(dataFranqueado[0].dataValues, emaildestino); //obj com dados dos cliente - msg padrão - msg de erro ou success - identificador do painel
  
      } */
}

router.get('/newFeat', (req, res) => {
  res.json({
    success: true,
    message: "testando nova feature"
  })
})


//SSO integrado
router.post('/login/consulta', loginConsulta.loginConsulta);

//credentialsApi CRUD
router.get('/credentialsApi', auth, credentialsApiController.index);
router.get('/credentialsApi/:id', auth, credentialsApiController.show);
router.post('/credentialsApi', auth, credentialsApiController.store);
router.put('/credentialsApi/:id', auth, credentialsApiController.update);
router.delete('/credentialsApi/:id', auth, credentialsApiController.destroy);

// Inativação em Massa (Exclusivo Administrador)
const massInactivationAdmin = require('../controllers/admin/massInactivationController');
router.post('/admin/mass-inactivation/preview', adminAuth, massInactivationAdmin.preview);
router.post('/admin/mass-inactivation/start', adminAuth, massInactivationAdmin.start);
router.get('/admin/mass-inactivation/status', adminAuth, massInactivationAdmin.status);
router.post('/admin/mass-inactivation/stop', adminAuth, massInactivationAdmin.stop);

router.auth = auth;
router.globalAuth = globalAuth;
router.adminAuth = adminAuth;

module.exports = router;




