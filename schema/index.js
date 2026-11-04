const relacPlanos = require('./tb_planos');
const Franqueado = require('./tb_franqueado');
const Faturamentos = require('./tb_faturamentos');

// Define associação entre Franqueado e Planos
Franqueado.hasMany(relacPlanos, { foreignKey: 'id_franqueado', as: 'planos' });
relacPlanos.belongsTo(Franqueado, { foreignKey: 'id_franqueado', as: 'franqueado' });

// Define associação entre Franqueado e Faturamentos
Franqueado.hasMany(Faturamentos, { foreignKey: 'id_franqueado', as: 'faturamentos' });
Faturamentos.belongsTo(Franqueado, { foreignKey: 'id_franqueado', as: 'franqueado' });

module.exports = {
    relacPlanos,
    Franqueado,
    Faturamentos
};
