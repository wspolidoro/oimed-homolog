const Sequelize = require('sequelize');
const { sequelize } = require('../db');

const Faturamentos = sequelize.define('oi_faturamentos', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    id_franqueado: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    mes_referencia: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Ex: 10/2026 ou 2026-10'
    },
    ano_referencia: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    total_vidas_individual: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    total_vidas_familiar: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    total_vidas: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    total_inativos_individual: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    total_inativos_familiar: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    detalhes_planos: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: 'JSON com contagem e valores detalhados de cada plano'
    },
    valor_individual: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    valor_familiar: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    valor_manutencao: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    valor_total: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    status: {
        type: Sequelize.STRING(30),
        defaultValue: 'pendente',
        comment: 'pendente, pago, cancelado'
    },
    data_vencimento: {
        type: Sequelize.DATEONLY,
        allowNull: true
    },
    data_pagamento: {
        type: Sequelize.DATE,
        allowNull: true
    },
    observacoes: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    fechado_por: {
        type: Sequelize.STRING(150),
        allowNull: true
    }
}, {
    tableName: 'oi_faturamentos',
    timestamps: true
});

module.exports = Faturamentos;
