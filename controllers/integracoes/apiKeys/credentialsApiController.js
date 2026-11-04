const CredentialsApi = require('../../../schema/tb_credentialsApi');
const { Op } = require('sequelize');
const crypto = require('crypto');

exports.index = async (req, res) => {
  try {
    const where = {};
    const partnerId = req.query.id_franqueado || req.query.id;
    if (partnerId) {
      where.id_franqueado = partnerId;
    }
    const credentials = await CredentialsApi.findAll({ where, order: [['id', 'DESC']] });

    // Mapeamento com aliases para suportar tanto os padrões legados quanto modernos
    const list = credentials.map(c => {
      const d = c.toJSON ? c.toJSON() : c;
      const isProd = d.modo === 'producao';
      return {
        ...d,
        api_url: isProd ? 'https://parceiro.painelw.com.br/api' : 'https://sandbox.painelw.com.br/api',
        clientId: d.api_key,
        client_id: d.api_key,
        clientSecret: d.secret_key,
        client_secret: d.secret_key,
        environment: isProd ? 'production' : 'sandbox',
      };
    });

    res.json(list);
  } catch (err) {
    console.error("Erro ao listar credenciais de API:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.store = async (req, res) => {
  try {
    const id_franqueado = req.body.id_franqueado || req.body.idParceiro || req.user?.id;
    if (!id_franqueado) {
      return res.status(400).json({ error: 'Identificador do parceiro/franqueado é obrigatório' });
    }

    // Normalização do modo (suporta 'production', 'producao', 'sandbox')
    let modoFinal = String(req.body.modo || req.body.environment || 'sandbox').toLowerCase().trim();
    if (modoFinal === 'production' || modoFinal === 'prod' || modoFinal === 'producao') {
      modoFinal = 'producao';
    } else {
      modoFinal = 'sandbox';
    }

    // Nome descritivo da credencial
    const nomeFinal = (req.body.nome && String(req.body.nome).trim()) 
      ? String(req.body.nome).trim() 
      : `Credencial API (${modoFinal === 'producao' ? 'Produção' : 'Sandbox'}) - Parceiro #${id_franqueado}`;

    const api_key = crypto.randomBytes(16).toString('hex');
    const secret_key = crypto.randomBytes(32).toString('hex');

    const credential = await CredentialsApi.create({
      id_franqueado,
      nome: nomeFinal,
      modo: modoFinal,
      api_key,
      secret_key,
      status: 'ativo'
    });

    const d = credential.toJSON ? credential.toJSON() : credential;
    const isProd = d.modo === 'producao';
    const responsePayload = {
      ...d,
      api_url: isProd ? 'https://parceiro.painelw.com.br/api' : 'https://sandbox.painelw.com.br/api',
      clientId: d.api_key,
      client_id: d.api_key,
      clientSecret: d.secret_key,
      client_secret: d.secret_key,
      environment: isProd ? 'production' : 'sandbox',
    };

    res.status(201).json(responsePayload);
  } catch (err) {
    console.error("Erro ao gerar credenciais de API:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.show = async (req, res) => {
  try {
    const credential = await CredentialsApi.findByPk(req.params.id);
    if (!credential) return res.status(404).json({ error: 'Credencial não encontrada' });
    
    const d = credential.toJSON ? credential.toJSON() : credential;
    const isProd = d.modo === 'producao';
    res.json({
      ...d,
      api_url: isProd ? 'https://parceiro.painelw.com.br/api' : 'https://sandbox.painelw.com.br/api',
      clientId: d.api_key,
      client_id: d.api_key,
      clientSecret: d.secret_key,
      client_secret: d.secret_key,
      environment: isProd ? 'production' : 'sandbox',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const credential = await CredentialsApi.findByPk(req.params.id);
    if (!credential) return res.status(404).json({ error: 'Credencial não encontrada' });
    
    const updateData = {};
    if (req.body.status !== undefined) {
      updateData.status = req.body.status;
    }
    if (req.body.nome !== undefined) {
      updateData.nome = String(req.body.nome).trim();
    }
    if (req.body.modo !== undefined || req.body.environment !== undefined) {
      const m = String(req.body.modo || req.body.environment).toLowerCase().trim();
      updateData.modo = (m === 'production' || m === 'producao') ? 'producao' : 'sandbox';
    }

    await credential.update(updateData);
    
    const d = credential.toJSON ? credential.toJSON() : credential;
    const isProd = d.modo === 'producao';
    res.json({
      ...d,
      api_url: isProd ? 'https://parceiro.painelw.com.br/api' : 'https://sandbox.painelw.com.br/api',
      clientId: d.api_key,
      client_id: d.api_key,
      clientSecret: d.secret_key,
      client_secret: d.secret_key,
      environment: isProd ? 'production' : 'sandbox',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.destroy = async (req, res) => {
  try {
    const credential = await CredentialsApi.findByPk(req.params.id);
    if (!credential) return res.status(404).json({ error: 'Credencial não encontrada' });
    await credential.destroy();
    res.status(200).json({ success: true, message: 'Credencial excluída com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};