const fs = require('fs');
const path = require('path');

// Defina o caminho do arquivo de log
const logFilePath = path.join(__dirname, 'app.log');

// Crie um fluxo de gravação para o arquivo de log
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Função auxiliar para formatar mensagens de log
function formatMessage(message) {
    if (typeof message === 'object') {
        try {
            return JSON.stringify(message, null, 2); // Converter o objeto para JSON formatado
        } catch (err) {
            return '[Erro ao converter objeto para JSON]';
        }
    }
    return message;
}

// Redefina a saída padrão e de erro para o arquivo de log
console.log = function (message) {
    logStream.write(`[LOG] ${new Date().toISOString()}: ${formatMessage(message)}\n`);
};

console.error = function (message) {
    logStream.write(`[ERROR] ${new Date().toISOString()}: ${formatMessage(message)}\n`);
};

// Exemplos de uso
console.log('Isso será registrado no arquivo de log.');
console.error('Isso será registrado como um erro no arquivo de log.');
console.log({ key: 'value', anotherKey: 123 }); // Log de um objeto

// Feche o fluxo de gravação quando o aplicativo for encerrado
process.on('exit', () => {
    logStream.end();
    console.log('Arquivo de log fechado.');
});

// Exporte as funções de log
module.exports = {
    log: console.log,
    error: console.error
};
