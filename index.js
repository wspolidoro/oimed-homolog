const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const port = process.env.PORT || 3035;
const rout = require('./routs/Routes');
const routerApi = require('./api/api');
const routerSandbox = require('./api/sandbox');
//debbug
const sendMailError = require('./routs/sendMailer.js');

//docs
const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('./swagger.json');

app.use('/api/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(cors());

app.use(bodyParser.json());
// Express modules / packages 

app.use(bodyParser.urlencoded({ extended: true }));
// Express modules / packages 

// expose static assets so the login consulta page can load its JS/CSS
const assetsDir = path.join(__dirname, 'parceiro.painelw.com.br/assets');
app.use('/assets', express.static(assetsDir));
const jsDir = path.join(__dirname, 'parceiro.painelw.com.br/views/formCadastroExterno/projeto-novo-samir');
app.use('/api/js', express.static(jsDir));



app.use('/api/', rout);

app.get('/mailerr', async (req, res) => {

	let sending = await sendMailError(req.query.id, "Vida não cadastrada na RD");
	if (sending) {
		res.json({ success: true, message: "Email enviado!" })
	}


});



/* app.use('/api', routerApi);
app.use('/sandbox', routerSandbox); */

app.use('/api/production', routerApi);
app.use('/api/sandbox', routerSandbox);


app.get('/login-consulta', (req, res) => {
	res.sendFile(path.join(__dirname, 'parceiro.painelw.com.br/views/login-consulta/index.html'));
});

app.get('/api/cadastro/oimed', (req, res) => {
	res.sendFile(path.join(__dirname, 'parceiro.painelw.com.br/views/formCadastroExterno/projeto-novo-samir/index.html'));
});

app.get('/api/thankyou', (req, res) => {
	res.sendFile(path.join(__dirname, 'parceiro.painelw.com.br/views/formCadastroExterno/projeto-novo-samir/thank-you.html'));
});

// serve the novo-samir form folder so its JS/CSS are delivered with the right MIME types
const novoSamirDir = path.join(__dirname, 'parceiro.painelw.com.br/views/formCadastroExterno/projeto-novo-samir');
app.use('/api/cadastro/oimed', express.static(novoSamirDir));

const dormir = require('./functions/crud');
const Sleeping = require('./schema/tb_sleeping');
const Clientes = require('./schema/tb_clientes.js');
require('dotenv').config();
const iniciar = require('./functions/massInactivate/processar.js')

//CONTROLLES
const { sleep, wakeUp } = require('./controllers/sleeping/index.js')

//LIBS
const { Op, Sequelize, literal } = require('sequelize');

const axios = require('axios');
const Franqueado = require('./schema/tb_franqueado.js');

/* async function testConnection() {
	const testeClient = await Clientes.findAll({
		where: {
			nu_documento: '79082278057'
		},
		raw: true,
		include: [{
			model: Sleeping,
			required: false // true = INNER JOIN / false = LEFT JOIN
		}]
	});


	console.log("testeClient: ", testeClient);
}

testConnection(); */


async function fallAsleep(cpf, uuid) {
	//const resultado = await dormir.delete(uuid);
	const resultado = await dormir.delete(cpf);

	console.log("dasadaadasdasdasd", resultado)

	try {
		if (!resultado) {
			console.log("erro: ", resultado);
			return;
		}

		Sleeping.create({
			idVida: cpf,
			uuid: resultado.beneficiary.uuid
		}).then((result) => {
			console.log("Entrou no sleeping: ", result.dataValues)
		}).catch((error) => {
			console.error(error.original.sqlMessage)
		});

		await Clientes.update({
			uuid: resultado.beneficiary.uuid
		}, {
			where: {
				nu_documento: cpf
			}
		})
	} catch (err) {
		console.log("erro ao inativar: ", err.message)
	}


}

/* fallAsleep("13781416798"); */



//wakeUp("3aa63d54-bdfc-44b8-b6b7-ad683ed12ded");

app.put('/api/cliente/toggleSleeping/:uuid', async (req, res) => {
	const id = req.params.uuid;

	const isSleeping = await sleep(id);

	if (isSleeping) {
		await wakeUp(isSleeping.uuid);
		res.status(200).json({ success: true, message: "Operação realizada com sucesso!" });
	}
});

app.put('/api/parceiro/inativar/:idFranqueado', async (req, res) => {
	const idFranqueado = req.params.idFranqueado;

	const inativar = await Franqueado.update({
		status: 'inativo'
	}, {
		where: {
			id: idFranqueado
		}
	});

	massInactivationPorParceiro(idFranqueado);

	res.status(200).json({ success: true, message: "Operação realizada com sucesso!" });
});

app.put('/api/parceiro/ativar/:idFranqueado', async (req, res) => {
	const idFranqueado = req.params.idFranqueado;

	const ativar = await Franqueado.update({
		status: 'ativo'
	}, {
		where: {
			id: idFranqueado
		}
	});

	res.status(200).json({ success: true, message: "Operação realizada com sucesso!" });
});

async function massInactivationPorParceiro(idFranqueado) {
	const exclusions = [
		"91459044568",
		"07170818345",
		"39439450819",
		"07428605660",
		"08705510511",
		"39439450819",
		"07428605660",
		"22149723743",
		"31057270865",
		"10151145717",
		"46849922840"
	];


	const normalizedExclusions = new Set(exclusions.map(cpf => cpf.replace(/\D/g, '')));
	const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


	const clientes = await Clientes.findAll({
		where: {
			situacao: 'ativo',
			nu_documento: { [Op.notIn]: exclusions },
			id_franqueado: idFranqueado,
			'$oi_sleeping.idVida$': { [Op.is]: null }
		},
		include: [{
			model: Sleeping,
			as: 'oi_sleeping',
			required: false,
			attributes: []
		}],
		raw: true,
		attributes: ['nu_documento', 'uuid'],
		limit: 15
	});

	for (const cliente of clientes) {
		const cpfDigits = cliente.nu_documento ? cliente.nu_documento.replace(/\D/g, '') : '';

		if (!cpfDigits || normalizedExclusions.has(cpfDigits)) {
			console.log(`Ignorando ${cliente.nu_documento || 'registro sem CPF'} (exclusão ou CPF inválido)`);
			await delay(5000);
			continue;
		}

		const alreadySleeping = await Sleeping.findOne({
			where: {
				[Op.or]: [
					{ idVida: cliente.nu_documento },
					{ idVida: cpfDigits }
				]
			}
		});

		if (alreadySleeping) {
			console.log(`Ignorando ${cliente.nu_documento} (já está na tabela sleeping)`);
			await delay(5000);
			continue;
		}

		try {
			console.log(`Inativando ${cliente.nu_documento}`);
			await fallAsleep(cliente.nu_documento, cliente.uuid);
		} catch (error) {
			console.error(`Erro ao inativar ${cliente.nu_documento}:`, error.message || error);
		}

		await delay(5000);
	}
}

const novadesativacao = require('./novadesativacao.json');

const cpfs = novadesativacao
	.filter(item => !['P', 'GP', 'GSP'].includes(item.serviceType))
	.map(item => item.cpf);

console.log("Total de CPFs para inativação:", cpfs.length);

async function massInactivation() {
	const exclusions = [
		"01678689505",
		"01758232005",
		"03771876150",
		"08358172532",
		"68980167504",
		"56548451104",
		"03980104800",
		"71091953171",
		"31057270865",
		"37917107884",
		"07064809290",
		"46849922840",
		"70505370476",
		"06025515522",
		"89250818572",
		"24700861835",
		"05948974596",
		"32978080809",
		"09176170616",
		"08292347305",
		"09109198792",
		"71028390572"
	];




	const inclusions = cpfs;


	const normalizedExclusions = new Set(exclusions.map(cpf => cpf.replace(/\D/g, '')));
	const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

	/*     const clientes = await Clientes.findAll({
			where: {
				situacao: 'ativo',
				nu_documento: { [Op.notIn]: exclusions }
			},
			include: [{
				model: Sleeping,
				required: false
			}],
			raw: true,
			attributes: ['nu_documento', 'uuid']
		}); */


	const clientes = await Clientes.findAll({
		where: {
			situacao: 'ativo',
			nu_documento: {
				[Op.in]: inclusions,
				[Op.notIn]: exclusions
			},
			//nu_documento: { [Op.notIn]: exclusions },
			// Use EXATAMENTE o nome que está no 'as' do include abaixo
			'$oi_sleeping.idVida$': { [Op.is]: null }
		},
		include: [{
			model: Sleeping,
			as: 'oi_sleeping', // Definimos o apelido manualmente aqui
			required: false,
			attributes: []
		}],
		raw: true,
		attributes: ['nu_documento', 'uuid'],
		limit: 15
	}).catch(error => {
		console.error("Erro ao buscar clientes:", error.message || error);
	});

	for (const cliente of clientes) {
		console.log(`Processando ${cliente.nu_documento}...`);
		const cpfDigits = cliente.nu_documento ? cliente.nu_documento.replace(/\D/g, '') : '';

		if (!cpfDigits || normalizedExclusions.has(cpfDigits)) {
			console.log(`Ignorando ${cliente.nu_documento || 'registro sem CPF'} (exclusão ou CPF inválido)`);
			await delay(5000);
			continue;
		}

		const alreadySleeping = await Sleeping.findOne({
			where: {
				[Op.or]: [
					{ idVida: cliente.nu_documento },
					{ idVida: cpfDigits }
				]
			}
		});

		if (alreadySleeping) {
			console.log(`Ignorando ${cliente.nu_documento} (já está na tabela sleeping)`);
			await delay(5000);
			continue;
		}

		try {
			console.log(`Inativando ${cliente.nu_documento}`);
			await fallAsleep(cliente.nu_documento, cliente.uuid);
		} catch (error) {
			console.error(`Erro ao inativar ${cliente.nu_documento}:`, error.message || error);
		}

		await delay(5000);
	}
}

//massInactivation()

//teste()

async function teste() {
	const clientes = await Clientes.findAll({
		where: {
			[Op.and]: [
				{ situacao: 'ativo' },
				{ id_franqueado: 76 }
				//{ uuid: "" }
			]
			//situacao: 'ativo'
		},
		raw: true,
		attributes: ['nu_documento', 'situacao', 'uuid'],
		include: [{
			model: Sleeping,
			required: false // true = INNER JOIN / false = LEFT JOIN
		}]
	});

	const result = clientes
		.map(item1 => {
			const found = arr2.find(item2 => item2.cpf === String(item1.nu_documento));
			return found ? found.uuid : null;
		})
		.filter(Boolean);

	console.log("very", result);

	const cpfToUuidMap = new Map(
		arr2.map(item => [item.cpf, item.uuid])
	);

	const updates = clientes
		.filter(c => !c.uuid)
		.map(async cliente => {
			const uuid = cpfToUuidMap.get(String(cliente.nu_documento));
			if (!uuid) return null;

			await Clientes.update({
				uuid: uuid
			}, {
				where: {
					nu_documento: cliente.nu_documento
				}
			})

			return {
				nu_documento: cliente.nu_documento,
				uuid
			};
		})
		.filter(Boolean);

	if (updates.length) {
		console.log(updates)
	}

}



app.listen(port, () => { // Listen on port 3000 
	console.log(`Listening! in port: ${port}`); // Log when listen success 
});








async function atualizarPlano() {

	const exclusions = [
		"31057270865",
		"06411162174",
		"05333611335",
		"46849922840",
		"04595528132",
		"39439450819",
		"10151145717",
		"91490227504",
		"81459521587",
		"15797940680",
		"06089979511",
		"13413726854",
		"05333611335",
		"06201467610",
		"12060286530",
		"10151145717",
		"31057270865",
		"14717258711",
		"02532383070",
		"02221437039",
		"18682558750",
		"25725702898",
		"07428605660",
		"49495364515",
		"18682562782",
		"08705510511",
		"07791966786"
	];

	const inclusions = [
		"07825175107", "01678689505", "94702306553", "00216480507", "05373566063",
		"21557688850", "03523739039", "07919296200", "02039932259", "27970251803",
		"02530045275", "06177466052", "35039380879", "13610723696", "39439450819",
		"35997791807", "06411162174", "00832284033", "54943171885", "47608808870",
		"40846851865", "94787530534", "07237239821", "48260428091", "07475729923",
		"03771876150", "08358172532", "68980167504", "41848244800", "37761177880",
		"54170656253", "37666683820", "46079059843", "13493057741", "09415529423",
		"04359021992", "30875798829", "02990891501", "34745041500", "10974073814",
		"40744623898", "65767535191", "04908834350", "09419057569", "54694280104",
		"33892285861", "01458530477", "55424430520", "46651837168", "86936344968",
		"12918410837", "16670898703", "04595528132", "37618551847", "08579142946",
		"28122608825", "71108368190", "40790219840", "02451406380", "05729713037",
		"12740989474", "06587126162", "98868250578", "42136302850", "05315531910",
		"12295865557", "11715960572", "01476087911", "00156532506", "82003114220",
		"02155211023", "02708179306", "05338563967", "97798282572", "45346638890",
		"10150022344", "49935563812", "05729703074", "04354788934", "10140164103",
		"70133156133", "05699328904", "04431321276", "12545440116", "12596262533",
		"86008151500", "76572951120", "73707309568", "43910082890", "04112562110",
		"47608710802", "04318966585", "05682217535", "35021999818", "39454218883",
		"71028390572", "32981295187", "86549663512", "09117082943", "90627300278",
		"59503750504", "49017694807", "41352127865", "37917107884", "11707508267",
		"08743855989", "03630327702", "44412127800", "46849922840", "09444399850",
		"71786341204", "06406842464", "75230380934", "07577973424", "02591115974",
		"89906870559", "18424570200", "70076438252", "08450966132", "13713148538",
		"05262865984", "08956538930", "27581415821", "10917249380", "56723825845",
		"09602373130", "04161031033", "02399586085", "10491193475", "22495412726",
		"44491040800", "85285749115", "07445404619", "88969746234", "96349930525",
		"31517856892", "02414116293", "08450972108", "08181968905", "02586504941",
		"76283380115", "05293344021", "09378314767", "14900574805", "60525649115",
		"98469088904", "06277795570", "06229245914", "98354698149", "64099199134",
		"02107483973", "79983391368", "07913666188", "06891216362", "58604910930",
		"06671480354", "08446521644", "07029988850", "24700861835", "45597349848",
		"03162321069", "22149723743", "08178316730", "09244178974", "07015218054",
		"91459044568", "28067684898", "25690785814", "80423671553", "27852389821",
		"11645976980", "37105086734", "11065719329", "50746519052", "04645384910",
		"02521341924", "25326945053", "12610312881", "02290950033", "15492019996",
		"04403262147", "87944219949", "10921846355", "09611536445", "08021991518",
		"09762612515", "75807416368", "00919773206", "04279448728", "97055085004",
		"05293267108", "17688187893", "08663987323", "46171700819", "02091106194",
		"97514837515", "68261624234", "07763768967", "37212184500", "03046089988",
		"45603928204", "42510382829", "06233842212", "63528904070", "71680853287",
		"10651819571", "13226068890", "91490227504", "79055800406", "04752399113",
		"15255623806", "15420423804", "01660688027", "13429691621", "12579795588",
		"05431927922", "54893258877", "12383943452", "14845064804", "08592758505",
		"32978080809", "32674686120", "09818239989", "07048033134", "05880482243",
		"59144572115", "38416490848", "05180883911", "14707263437", "07170818345",
		"35447314879", "05729728069", "81086628187", "83818553734"
	]

	const clientes = await Clientes.findAll({
		where: {
			situacao: 'ativo',
			nu_documento: {
				[Op.in]: inclusions,
				[Op.notIn]: exclusions
			}

		},
		raw: true,
		attributes: ['nu_documento', 'uuid'],
		limit: 100
	});

	console.log(clientes.length)

	arrGeral.map((item) => {
		/*   if (item.serviceType == "P" || item.serviceType == "GP" || item.serviceType == "GSP") {
			  console.log(item.cpf)
			  
		  } */

		if (item.serviceType != "P" && item.serviceType != "GP" && item.serviceType != "GSP") {
			//console.log(item.cpf)

		}
	})
}

//atualizarPlano()





const tiposRemover = ['P', 'GP', 'GSP'];

/* const novoArray = novadesativacao.filter(
	item => !tiposRemover.includes(item.serviceType)
); */



//console.log(cpfs);



console.log("Data loaded successfully.", novadesativacao.length);