const Sequelize = require('sequelize');
const { sequelize, sandbox } = require('../db');

const SubFranqueado = sequelize.define('oi_sub_franqueado', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },

    idFranqueadoMaster: {
        type: Sequelize.NUMBER,
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    nome: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },
    
    cpf: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    telefone: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    email: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    password: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    total_clientes: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    vendas: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    dado_banc: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    dado_pix: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    site_venda: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },
    
    siteTitle: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: false
    },
    
    siteEmail: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: false
    },

    status: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    perfil: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: false,
        validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        }
    },

    products: {
        type: Sequelize.STRING(150),
        allowNull: true,
        unique: false
    },

    linkAndroid: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: false
    },

    linkApple: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: false
    },

    tokenAsaas: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: false
    },

    subPaineis: {
        type: Sequelize.BOOLEAN(),
        allowNull: false,
        unique: false,
        /* validate: {
            notEmpty: {
                msg: "Esse campo não pode está vazio.."
            },
        } */
    }

});

module.exports = SubFranqueado;