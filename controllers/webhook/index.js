const { sequelize, sandbox } = require('../../db');
const SubFranqueado = require('../../schema/tb_sub_franqueado');

//DEBBUG
const { sendMailError, mailerNewCadastro } = require('../../routs/sendMailer.js');

module.exports = {
    inativar: async (req, res) => {
        res.send('ok')
        return;
        const listSubFranqueado = await SubFranqueado.findAll({
          where: {
          idFranqueadoMaster: req.params.id
          }
        });

        res.json(listSubFranqueado);

    },
}