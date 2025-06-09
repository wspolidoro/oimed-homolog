const { sequelize, sandbox } = require('../../db');
const { faker } = require('@faker-js/faker');
const SubFranqueado = require('../../schema/tb_sub_franqueado');
const SubClientes = require('../../schema/tb_sub_clientes.js');
const Franqueado = require('../../schema/tb_franqueado.js');
const Clientes = require('../../schema/tb_clientes.js');

module.exports = {
    listParceiros: async (req, res) => {
        const linkFranqueado = await Franqueado.findAll({
            order: [["nome", "ASC"]],
            offset: 2,
            attributes: ['id', 'nome']
        });

        res.json(linkFranqueado);

    },
    listDados: async (req, res) => {
        //INDIVIDUAL
        const listClientes = await Clientes.findAll({
            where: {
                id_franqueado: req.params.id,
                cobertura: "individual",
                //situacao: "ativo"
            },
            attributes: ['id', 'nm_cliente', 'serviceType', 'dtDesativacao', 'cobertura', 'situacao'],
            raw: true
        });
        

        const qtdaG = listClientes.filter(item => item.serviceType === "G" && item.situacao === "ativo").length;
        const qtdaP = listClientes.filter(item => item.serviceType === "P" && item.situacao === "ativo").length;
        const qtdaGP = listClientes.filter(item => item.serviceType === "GP" && item.situacao === "ativo").length;
        const qtdaGS = listClientes.filter(item => item.serviceType === "GS" && item.situacao === "ativo").length;
        const qtdaGSP = listClientes.filter(item => item.serviceType === "GSP" && item.situacao === "ativo").length;

        const countPlans = {
            G: qtdaG,
            P: qtdaP,
            GP: qtdaGP,
            GS: qtdaGS,
            GSP: qtdaGSP
        };

 /*        const calcTotal = countPlans.reduce((acc, obj) => {
            const total = Object.values(obj)[0];
            return acc + total;
        }, 0) */

        const calcTotal = Object.values(countPlans).reduce((acc, total) => acc + total, 0);

        console.log(listClientes)

        const currentDeactivate = listClientes.filter(item => {

            if(item.situacao === "ativo") return;

            const data = new Date(item.dtDesativacao);
            const hoje = new Date();

            const mesmoMes = data.getUTCFullYear() === hoje.getUTCFullYear() &&
                data.getUTCMonth() === hoje.getUTCMonth();

            console.log(mesmoMes)
            return mesmoMes;

        })

        //FAMILIAR
        const listClientesFamiliar = await Clientes.findAll({
            where: {
                id_franqueado: req.params.id,
                cobertura: "familiar",
                //situacao: "ativo"
            },
            attributes: ['id', 'nm_cliente', 'serviceType', 'dtDesativacao', 'cobertura', 'situacao'],
            raw: true
        });

        const qtdaGFamiliar = listClientesFamiliar.filter(item => item.serviceType === "G" && item.situacao === "ativo").length;
        const qtdaPFamiliar = listClientesFamiliar.filter(item => item.serviceType === "P" && item.situacao === "ativo").length;
        const qtdaGPFamiliar = listClientesFamiliar.filter(item => item.serviceType === "GP" && item.situacao === "ativo").length;
        const qtdaGSFamiliar = listClientesFamiliar.filter(item => item.serviceType === "GS" && item.situacao === "ativo").length;
        const qtdaGSPFamiliar = listClientesFamiliar.filter(item => item.serviceType === "GSP" && item.situacao === "ativo").length;

        const countPlansFamiliar = {
            G: qtdaGFamiliar,
            P: qtdaPFamiliar,
            GP: qtdaGPFamiliar,
            GS: qtdaGSFamiliar,
            GSP: qtdaGSPFamiliar
        };

    /*     const calcTotalFamiliar = countPlansFamiliar.reduce((acc, obj) => {
            const total = Object.values(obj)[0];
            return acc + total;
        }, 0)
 */


        const calcTotalFamiliar = Object.values(countPlansFamiliar).reduce((acc, total) => acc + total, 0);

        console.log(listClientesFamiliar)

        const currentDeactivateFamiliar = listClientesFamiliar.filter(item => {

            if(item.situacao === "ativo") return;

            const data = new Date(item.dtDesativacao);
            const hoje = new Date();

            const mesmoMes = data.getUTCFullYear() === hoje.getUTCFullYear() &&
                data.getUTCMonth() === hoje.getUTCMonth();

            // console.log(mesmoMes)
            return mesmoMes;

        })


        console.log("insou",currentDeactivate)


        res.json({
            succes: true,
            individualPlan: { qtdaPlans: countPlans, totalRegister: calcTotal, totalInativates: currentDeactivate.length },
            familiarPlan: { qtdaPlans: countPlansFamiliar, totalRegister: calcTotalFamiliar, totalInativates: currentDeactivateFamiliar.length }
        });

    }
}





const contagem = {
    "3": 1,
    "28235758": 1,
    "45461210": 1,
    "49622145": 1,
    "82974789": 1,
    "271421673": 1,
    "278639135": 1,
    "446180858": 1,
    "447001647": 1,
    "498210677": 1,
    "591598639": 2,
    "656859547": 1,
    "781315379": 1,
    "907173683": 1,
    "1232041602": 2,
    "1273013646": 1,
    "1318339286": 1,
    "1327424622": 3,
    "1422250610": 1,
    "1446446654": 1,
    "1508099219": 1,
    "1650366659": 1,
    "1693842335": 1,
    "1858768624": 1,
    "1909314854": 1,
    "1929772610": 1,
    "1930743629": 1,
    "1944972595": 1,
    "1946022659": 1,
    "2053597607": 1,
    "2061143628": 1,
    "2166614639": 1,
    "2167876106": 1,
    "2190758670": 1,
    "2220599159": 1,
    "2300410605": 1,
    "2312647630": 1,
    "2324359600": 1,
    "2329066708": 1,
    "2426800623": 1,
    "2529474524": 1,
    "2609404611": 1,
    "2747242358": 3,
    "2767786264": 1,
    "2988036152": 1,
    "3114985661": 2,
    "3138363709": 1,
    "3187111920": 1,
    "3340345155": 1,
    "3342698578": 1,
    "3377811508": 1,
    "3410172130": 1,
    "3609108150": 1,
    "3697657291": 1,
    "3771876150": 1,
    "3779834545": 1,
    "3865351247": 1,
    "3870523301": 1,
    "3899913094": 1,
    "3977720503": 1,
    "7417681603": 3,
    "4354788934": 1,
    "87944219949": 1,
    "9769253626": 1,
    "11829720635": 3,
    "8974509652": 1,
    "7932485665": 1,
    "63361280672": 1,
    "6692283620": 1,
    "7458769602": 1,
    "12565320612": 2,
    "7874627644": 1,
    "14380006697": 1,
    "9161990612": 1,
    "10807665614": 1,
    "8982498648": 1,
    "70710791100": 1,
    "8124522677": 1,
    "7182218348": 2,
    "16958583604": 1,
    "7182188333": 1,
    "9438145885": 1,
    "11069680699": 1,
    "9937758610": 1,
    "13188883609": 1,
    "12035849624": 2,
    "8285488624": 1,
    "11472414659": 1,
    "5881150619": 1,
    "12254021664": 1,
    "9085132673": 1,
    "8184630662": 1,
    "7950350636": 2,
    "8549280658": 1,
    "11480805629": 1,
    "14006556683": 1,
    "5491106666": 1,
    "16704954694": 2,
    "8979760612": 1,
    "16363765684": 3,
    "6849514601": 1,
    "4980854656": 1,
    "14111850642": 3,
    "7425004623": 1,
    "7349833601": 1,
    "10808055674": 3,
    "8055908621": 1,
    "7574294674": 1,
    "17265820606": 1,
    "8157964636": 1,
    "13401474677": 1,
    "9500084600": 2,
    "7372053692": 2,
    "9636642630": 1,
    "8202835682": 1,
    "13477414616": 1,
    "13647560642": 1,
    "18104673220": 1,
    "7418413203": 1,
    "7898457331": 1,
    "5541150345": 1,
    "9099084358": 1,
    "4329376172": 1,
    "51700450182": 1,
    "6891216362": 1,
    "79983391368": 1,
    "5574151286": 1,
    "5614526528": 1,
    "4606231840": 1,
    "68359462453": 1,
    "5402541698": 1,
    "6076299673": 1,
    "4309552196": 1,
    "6885434566": 1,
    "5784370588": 1,
    "5125764590": 1,
    "8781597460": 1,
    "4889133658": 1,
    "5204691359": 1,
    "12720699667": 1,
    "5499922195": 1,
    "6390379846": 1,
    "4548814108": 1,
    "5681629198": 1,
    "6087136193": 1,
    "7428605660": 2,
    "7318177028": 1,
    "7440965884": 1,
    "5034153912": 1,
    "5921249670": 1,
    "5339704661": 1,
    "10599055669": 1,
    "8051322878": 1,
    "7458849541": 1,
    "7562886571": 1,
    "8705510511": 1,
    "17112001072": 1,
    "8690937463": 1,
    "6345397369": 1,
    "82302871391": 2,
    "6968091330": 1,
    "6671480354": 1,
    "7690965814": 2,
    "7989275856": 1,
    "8773379859": 1,
    "8242736642": 1,
    "6979170619": 1,
    "5130236661": 1,
    "9289047844": 1,
    "6201467610": 1,
    "8249107969": 1,
}

let csv = 'cpf,status\n';

for (const cpf in contagem) {
    const status = contagem[cpf] > 1 ? 'familiar' : 'individual';
    csv += `${cpf},${status}\n`;
}

const fs = require('fs');
//fs.writeFileSync('resultado.csv', csv);