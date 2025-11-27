const fs = require('fs/promises');
const dormir = require('../crud');

const DELAY_MS = 2000; // 1 requisição a cada 2s
const MAX_CONCURRENT = 1; // fila controlada -> apenas 1 ativo por vez

async function fallAsleep(cpf, uuid) {
    const resultado = await dormir.delete(uuid);

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
    } catch (err) {
        console.log("erro ao inativar: ", err.message)
    }


}

// delay
const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function loadJSON(file) {
    try {
        const data = await fs.readFile(file, 'utf8');
        return JSON.parse(data);
    } catch {
        return []; // se não existir, inicia vazio
    }
}

async function saveJSON(file, data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
}

async function queue(items, handler) {
    const active = [];

    for (const item of items) {
        const task = (async () => {
            await handler(item);
            await wait(DELAY_MS); // rate limit
        })();

        active.push(task);

        // mantém limite de concorrência
        if (active.length >= MAX_CONCURRENT)
            await Promise.race(active);

        // remove finalizados
        for (let i = active.length - 1; i >= 0; i--)
            if (active[i].status === 'fulfilled' || active[i].status === 'rejected')
                active.splice(i, 1);
    }

    await Promise.allSettled(active);
}

// ======================================
//  PROCESSAMENTO PRINCIPAL
// ======================================

async function iniciar(clientes, listaSleeping, listaVidasAtivas) {

    let processados = await loadJSON('./progresso.json');
    let erros = await loadJSON('./erros.json');

    console.log(`🔄 Retomando processamento...`);
    console.log(`📄 Processados até agora: ${processados.length}`);
    console.log(`⚠ Erros registrados: ${erros.length}\n`);

    // remove quem já foi processado
    const pendentes = clientes.filter(c => !processados.includes(c.nu_documento));

    console.log(`🚀 Faltam processar: ${pendentes.length} vidas\n`);

    await queue(pendentes, async (cliente) => {

        const cpf = cliente.nu_documento;
        console.log(`\n📍 CPF: ${cpf}`);

        if (listaSleeping.has(cpf)) {
            console.log("⏩ Já está sleeping. Pulando...");
            return;
        }

        const pessoa = listaVidasAtivas.find(x => x.cpf == cpf);

        if (!pessoa) {
            console.log("❌ CPF não encontrado nos ativos.");
            erros.push(cpf);
            await saveJSON('./erros.json', erros);
            return;
        }

        try {
            console.log(`➡ Inativando: ${pessoa.name} / ${pessoa.uuid}`);
            await fallAsleep(cpf, pessoa.uuid);

            processados.push(cpf);
            await saveJSON('./progresso.json', processados);

            console.log("✔ Sucesso — aguardando para próxima requisição...");

        } catch (err) {
            console.log("🔥 ERRO:", err.message);
            erros.push(cpf);
            await saveJSON('./erros.json', erros);
        }
    });

    console.log("\n🏁 FINALIZADO");
    console.log(`✔ Processados: ${processados.length}`);
    console.log(`⚠ Erros: ${erros.length}`);
}

module.exports = iniciar;