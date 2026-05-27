const CredentialsApi = require('../../../schema/tb_credentialsApi');
const { Op } = require('sequelize');
const crypto = require('crypto');

exports.index = async (req, res) => {
  try {
    const where = {};
    if (req.query.id_franqueado) {
      where.id_franqueado = req.query.id_franqueado;
    }
    const credentials = await CredentialsApi.findAll({ where, order: [['id', 'DESC']] });
    res.json(credentials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.store = async (req, res) => {
  try {
    const { id_franqueado, nome, modo } = req.body;

    const api_key = crypto.randomBytes(16).toString('hex');
    const secret_key = crypto.randomBytes(32).toString('hex');

    const credential = await CredentialsApi.create({ id_franqueado, nome, modo, api_key, secret_key, status: 'ativo' });
    res.status(201).json(credential);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.show = async (req, res) => {
  try {
    const credential = await CredentialsApi.findByPk(req.params.id);
    if (!credential) return res.status(404).json({ error: 'Não encontrado' });
    res.json(credential);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const credential = await CredentialsApi.findByPk(req.params.id);
    if (!credential) return res.status(404).json({ error: 'Não encontrado' });
    await credential.update(req.body);
    res.json(credential);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.destroy = async (req, res) => {
  try {
    const credential = await CredentialsApi.findByPk(req.params.id);
    if (!credential) return res.status(404).json({ error: 'Não encontrado' });
    await credential.destroy();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};