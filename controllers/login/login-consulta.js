//CONFIGS
require('dotenv').config();

//SCHEMAS
const Clientes = require('../../schema/tb_clientes');
const SubClientes = require('../../schema/tb_sub_clientes');
const Sleeping = require('../../schema/tb_sleeping');
const Rapidoc = require('../../schema/tb_rapidoc');
const { Op } = require('sequelize');
const axios = require('axios');

//CONTROLLERS & SERVICES
const { ativarBeneficiarioSubpainel } = require('../sub_franqueados/ativarBeneficiario.js');

const rapidocBaseUrl = process.env.API_URL || 'https://api.rapidoc.tech/tema/api';
const clientIdRapidoc = process.env.CLIENT_ID || '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32';
const authRapidoc = process.env.AUTHORIZATION || 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo';

const rapidocHeaders = {
    'clientId': clientIdRapidoc,
    'Authorization': authRapidoc,
    'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
};

function paymentVerification(paymentType) {
    if (!paymentType) return 'S';
    const pt = String(paymentType).toUpperCase().trim();
    if (pt === 'A') return 'A';
    return 'S';
}

function serviceVerification(serviceType) {
    if (!serviceType) return 'G';
    const st = String(serviceType).toUpperCase().trim();
    if (st === 'GS' || st === 'GSP') return 'G';
    return st || 'G';
}

function formatBirthday(dateStr) {
    if (!dateStr) return '2000-01-01';
    const s = String(dateStr).trim();
    if (s.includes('/')) {
        const parts = s.split('/');
        if (parts.length === 3) {
            return `${parts[2].trim()}-${parts[1].trim().padStart(2, '0')}-${parts[0].trim().padStart(2, '0')}`;
        }
    }
    if (s.includes('-')) {
        const parts = s.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            return s;
        }
    }
    const cleanDigits = s.replace(/\D/g, '');
    if (cleanDigits.length === 8) {
        const d = cleanDigits.substr(0, 2);
        const m = cleanDigits.substr(2, 2);
        const y = cleanDigits.substr(4, 4);
        return `${y}-${m}-${d}`;
    }
    return s;
}

function formatState(state) {
    if (!state) return 'SP';
    const st = String(state).trim();
    if (st.length <= 2) return st.toUpperCase();
    const match = st.match(/\(([A-Z]{2})\)/i);
    if (match) return match[1].toUpperCase();
    return st.substr(st.length - 2).toUpperCase();
}

/**
 * Consulta beneficiário na Rapidoc pelo CPF
 */
async function consultarBeneficiarioRapidoc(cpf) {
    try {
        const cleanCpf = String(cpf).replace(/\D/g, '');
        const res = await axios.get(`${rapidocBaseUrl}/beneficiaries/${cleanCpf}`, {
            headers: rapidocHeaders,
            validateStatus: () => true
        });
        if (res.status === 200 && res.data && res.data.success && res.data.beneficiary) {
            return {
                exists: true,
                isActive: Boolean(res.data.beneficiary.isActive),
                uuid: res.data.beneficiary.uuid,
                beneficiary: res.data.beneficiary
            };
        }
        return { exists: false, isActive: false, uuid: null };
    } catch (err) {
        console.warn("Erro ao consultar Rapidoc por CPF:", err.message);
        return { exists: false, isActive: false, uuid: null };
    }
}

/**
 * Reativa um beneficiário existente na Rapidoc usando seu UUID
 */
async function reativarBeneficiarioRapidoc(uuid, cpf) {
    try {
        console.log(`Reativando beneficiário ${cpf} (UUID: ${uuid}) na Rapidoc...`);
        const res = await axios.put(`${rapidocBaseUrl}/beneficiaries/${uuid}/reactivate`, "data", {
            headers: rapidocHeaders,
            validateStatus: () => true
        });
        console.log("Resposta reativação Rapidoc:", res.data);

        // Remove do Sleeping
        await Sleeping.destroy({
            where: {
                [Op.or]: [
                    { idVida: cpf },
                    { uuid: uuid }
                ]
            }
        }).catch(() => {});

        // Atualiza status do cliente para ativo
        await Clientes.update({
            situacao: 'ativo',
            dtAtivacao: new Date(),
            uuid: uuid
        }, {
            where: {
                [Op.or]: [
                    { nu_documento: cpf },
                    { uuid: uuid }
                ]
            }
        }).catch(() => {});

        return { success: true, uuid };
    } catch (err) {
        console.error("Erro na reativação na Rapidoc:", err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Realiza a ativação completa do beneficiário (e dependentes) na Rapidoc
 */
async function ativarCompletoRapidoc(cliente) {
    const cpf = String(cliente.nu_documento).replace(/\D/g, '');
    const cleanState = formatState(cliente.state);
    const birthdayFormat = formatBirthday(cliente.birthday);

    const arrBD = [
        {
            "name": cliente.nm_cliente,
            "cpf": cpf,
            "birthday": birthdayFormat,
            "phone": String(cliente.telefone || '').replace(/\D/g, ''),
            "email": cliente.email || `${cpf}@oimed.com.br`,
            "zipCode": String(cliente.zip_code || '').replace(/\D/g, ''),
            "address": cliente.address || "Rua Principal, 100",
            "city": cliente.city || "São Paulo",
            "state": cleanState,
            "paymentType": paymentVerification(cliente.paymentType),
            "serviceType": serviceVerification(cliente.serviceType),
            "holder": cpf,
            "general": String(cliente.id_franqueado || '')
        }
    ];

    // Dependentes
    let dataArr = [];
    if (cliente.beneficiarios) {
        try {
            let bStr = cliente.beneficiarios;
            if (typeof bStr === 'string') {
                if ((bStr.startsWith('"') && bStr.endsWith('"')) || (bStr.startsWith("'") && bStr.endsWith("'"))) {
                    bStr = bStr.slice(1, -1).replace(/\\"/g, '"');
                }
                dataArr = JSON.parse(bStr);
            } else if (Array.isArray(bStr)) {
                dataArr = bStr;
            }
        } catch (e) {
            console.warn("Aviso ao fazer parse de dependentes:", e.message);
        }
    }

    if (Array.isArray(dataArr) && dataArr.length > 0) {
        for (let i = 1; i <= 3; i++) {
            const dep = dataArr[i - 1];
            if (dep && dep[`nu_documento${i}`]) {
                const depState = formatState(dep[`state${i}`] || cleanState);
                arrBD.push({
                    "name": dep[`nm_cliente${i}`],
                    "cpf": String(dep[`nu_documento${i}`]).replace(/\D/g, ''),
                    "birthday": formatBirthday(dep[`birthday${i}`]),
                    "phone": String(dep[`telefone${i}`] || cliente.telefone || '').replace(/\D/g, ''),
                    "email": dep[`email${i}`] || cliente.email || `${cpf}@oimed.com.br`,
                    "zipCode": String(dep[`zipCode${i}`] || cliente.zip_code || '').replace(/\D/g, ''),
                    "address": dep[`address${i}`] || cliente.address || "Rua Principal, 100",
                    "city": dep[`city${i}`] || cliente.city || "São Paulo",
                    "state": depState,
                    "paymentType": paymentVerification(cliente.paymentType),
                    "serviceType": serviceVerification(cliente.serviceType),
                    "holder": cpf,
                    "general": String(cliente.id_franqueado || '')
                });
            }
        }
    }

    console.log("Enviando criação completa de beneficiário para Rapidoc:", arrBD);
    const response = await axios.post(`${rapidocBaseUrl}/beneficiaries`, arrBD, {
        headers: rapidocHeaders,
        validateStatus: () => true
    });

    console.log("Resposta criação Rapidoc:", response.data);

    if (response.data && response.data.success === true) {
        const createdUuid = response.data.beneficiaries?.[0]?.uuid || null;
        if (createdUuid) {
            await Clientes.update({
                situacao: 'ativo',
                dtAtivacao: new Date(),
                uuid: createdUuid
            }, {
                where: { nu_documento: cliente.nu_documento }
            }).catch(() => {});

            await Rapidoc.findOrCreate({
                where: { cpf: cpf },
                defaults: {
                    nome: cliente.nm_cliente,
                    cpf: cpf,
                    uuid: createdUuid,
                    birthday: birthdayFormat
                }
            }).catch(() => {});

            await Sleeping.destroy({
                where: {
                    [Op.or]: [
                        { idVida: cpf },
                        { uuid: createdUuid }
                    ]
                }
            }).catch(() => {});
        }
        return { success: true, uuid: createdUuid };
    } else {
        // Fallback: se a Rapidoc informar que o beneficiário já existe/já foi cadastrado/já utilizado
        const msg = String(response.data?.message || '').toLowerCase();
        if (msg.includes('já utilizado') || msg.includes('já cadastrado') || msg.includes('já existe') || msg.includes('already exists')) {
            console.log(`Beneficiário ${cpf} já existia na Rapidoc. Consultando UUID para reativar...`);
            const consulta = await consultarBeneficiarioRapidoc(cpf);
            const uuidToReactivate = consulta.uuid || cliente.uuid;
            if (uuidToReactivate) {
                return await reativarBeneficiarioRapidoc(uuidToReactivate, cpf);
            }
        }
        return { success: false, message: response.data?.message || "Falha na ativação na Rapidoc." };
    }
}

module.exports = {
    loginConsulta: async (req, res) => {
        try {
            console.log("Chamada em loginConsulta:", req.body);
            if (!req.body || !req.body.nuCpf || !req.body.password) {
                return res.status(200).json({ success: false, message: "CPF e senha são obrigatórios." });
            }

            const rawCpf = String(req.body.nuCpf).trim();
            const cleanCpf = rawCpf.replace(/\D/g, '');

            let cliente = await Clientes.findOne({
                where: {
                    [Op.or]: [
                        { nu_documento: cleanCpf },
                        { nu_documento: rawCpf }
                    ]
                },
                raw: true
            });

            let isSubCliente = false;

            if (!cliente) {
                cliente = await SubClientes.findOne({
                    where: {
                        [Op.or]: [
                            { nu_documento: cleanCpf },
                            { nu_documento: rawCpf }
                        ]
                    },
                    raw: true
                });

                if (cliente) {
                    isSubCliente = true;
                }
            }

            if (!cliente) {
                return res.status(200).json({ success: false, message: "Cliente não encontrado." });
            }

            const cpf = cliente.nu_documento;
            const cpfClean = String(cpf).replace(/\D/g, '');
            const senhaValida1 = cpfClean.slice(0, 4);
            const senhaValida2 = String(cpf).slice(0, 4);
            const senhaInput = String(req.body.password).trim();

            if (senhaInput !== senhaValida1 && senhaInput !== senhaValida2) {
                return res.status(200).json({ success: false, message: "CPF ou Senha incorreto." });
            }

            if (isSubCliente) {
                try {
                    console.log("Ativando subcliente na base antes do login:", cpf);
                    await ativarBeneficiarioSubpainel(cpf);
                } catch (errAtivacao) {
                    console.log("Erro ao ativar subcliente na base antes do login:", errAtivacao);
                }
            }

            // --- CASO 1: A VIDA ESTÁ EM SLEEPING? ---
            const isSleeping = await Sleeping.findOne({
                where: {
                    [Op.or]: [
                        { idVida: cpfClean },
                        { idVida: cpf },
                        ...(cliente.uuid ? [{ uuid: cliente.uuid }] : [])
                    ]
                },
                raw: true
            });

            if (isSleeping) {
                console.log(`Cliente ${cpfClean} está em Sleeping. Retirando de Sleeping e reativando na Rapidoc...`);

                // 1. Remove de Sleeping
                await Sleeping.destroy({
                    where: {
                        [Op.or]: [
                            { idVida: cpfClean },
                            { idVida: cpf },
                            ...(isSleeping.uuid ? [{ uuid: isSleeping.uuid }] : [])
                        ]
                    }
                }).catch(() => {});

                // 2. Reativa na Rapidoc
                let uuidParaReativar = isSleeping.uuid || cliente.uuid;
                if (!uuidParaReativar) {
                    const infoRapidoc = await consultarBeneficiarioRapidoc(cpfClean);
                    if (infoRapidoc.uuid) uuidParaReativar = infoRapidoc.uuid;
                }

                if (uuidParaReativar) {
                    await reativarBeneficiarioRapidoc(uuidParaReativar, cpfClean);
                    return res.status(200).json({ 
                        success: true, 
                        message: "Operação realizada com sucesso!", 
                        urlRedirect: `https://atendimento.consultaonline.app.br/${clientIdRapidoc}/beneficiary/${uuidParaReativar}` 
                    });
                } else {
                    // Se não tiver UUID, realiza ativação completa
                    const resAtiv = await ativarCompletoRapidoc(cliente);
                    if (resAtiv.success && resAtiv.uuid) {
                        return res.status(200).json({ 
                            success: true, 
                            message: "Operação realizada com sucesso!", 
                            urlRedirect: `https://atendimento.consultaonline.app.br/${clientIdRapidoc}/beneficiary/${resAtiv.uuid}` 
                        });
                    }
                }
            }

            // --- CASO 2: NÃO ESTÁ EM SLEEPING -> VALIDA SE ESTÁ ATIVO NA RAPIDOC ---
            console.log(`Consultando status de ${cpfClean} na Rapidoc...`);
            const infoRapidoc = await consultarBeneficiarioRapidoc(cpfClean);

            // 2.1: Vida já está ativa na Rapidoc
            if (infoRapidoc.exists && infoRapidoc.isActive && infoRapidoc.uuid) {
                console.log(`Cliente ${cpfClean} já está ativo na Rapidoc.`);
                await Clientes.update({
                    uuid: infoRapidoc.uuid,
                    situacao: 'ativo'
                }, {
                    where: { nu_documento: cpf }
                }).catch(() => {});

                return res.status(200).json({ 
                    success: true, 
                    message: "Operação realizada com sucesso!", 
                    urlRedirect: `https://atendimento.consultaonline.app.br/${clientIdRapidoc}/beneficiary/${infoRapidoc.uuid}` 
                });
            }

            // 2.2: Vida existe na Rapidoc, mas NÃO está ativa -> Reativa
            if (infoRapidoc.exists && !infoRapidoc.isActive && infoRapidoc.uuid) {
                console.log(`Cliente ${cpfClean} existe na Rapidoc mas está inativo. Reativando na Rapidoc...`);
                const resReat = await reativarBeneficiarioRapidoc(infoRapidoc.uuid, cpfClean);
                if (resReat.success) {
                    return res.status(200).json({ 
                        success: true, 
                        message: "Operação realizada com sucesso!", 
                        urlRedirect: `https://atendimento.consultaonline.app.br/${clientIdRapidoc}/beneficiary/${infoRapidoc.uuid}` 
                    });
                }
            }

            // 2.3: Vida não está ativa e não existe (ou reativação direta não resolveu) -> Realiza ativação completa
            console.log(`Cliente ${cpfClean} não está ativo na Rapidoc. Realizando ativação completa...`);
            const resAtiv = await ativarCompletoRapidoc(cliente);

            if (resAtiv.success && resAtiv.uuid) {
                return res.status(200).json({ 
                    success: true, 
                    message: "Operação realizada com sucesso!", 
                    urlRedirect: `https://atendimento.consultaonline.app.br/${clientIdRapidoc}/beneficiary/${resAtiv.uuid}` 
                });
            } else {
                console.error("Falha ao ativar vida na Rapidoc:", resAtiv);
                return res.status(200).json({ 
                    success: false, 
                    message: resAtiv.message || "Não foi possível ativar sua vida na base de consultas. Entre em contato com a administração." 
                });
            }

        } catch (error) {
            console.error("Erro geral no loginConsulta:", error);
            return res.status(500).json({ success: false, message: "Ocorreu um erro ao processar a solicitação.", error: error.message });
        }
    }
};