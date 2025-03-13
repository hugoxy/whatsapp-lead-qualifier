// Importações necessárias
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');
const axios = require('axios');
const pino = require('pino');
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public'))); // Servir arquivos estáticos da pasta "public"

// Estado da conversa para WhatsApp e Widget
const conversations = {};

// Função para carregar ou criar o arquivo JSON
function loadLeads() {
    try {
        if (fs.existsSync('leads.json')) {
            const data = fs.readFileSync('leads.json', 'utf8');
            return JSON.parse(data);
        }
        return { leads: [] };
    } catch (error) {
        console.error('Erro ao carregar leads:', error);
        return { leads: [] };
    }
}

// Função para salvar em JSON
function saveToJson(leadData) {
    const leadsData = loadLeads();
    leadsData.leads.push(leadData);
    fs.writeFileSync('leads.json', JSON.stringify(leadsData, null, 2), 'utf8');
}

// Lista de perguntas
const questions = [
    'Qual é o seu nome?',
    'Qual é o seu email?',
    'Qual é o seu interesse?',
    'Você está pronto para comprar agora?',
    'Qual é o seu orçamento?'
];

const WELCOME_MESSAGE = `Olá!\nPara que possamos seguir com a contratação do serviço ou produto.\n\nResponda às próximas 5 perguntas, é bem rápido!`;
const LEAD_QUALIFIED_MESSAGE = `Você é um lead qualificado. Obrigado!\n\nEm breve um de nossos especialistas entrará em contato.`;
const LEAD_NOT_QUALIFIED_MESSAGE = `Você é um lead não qualificado. Obrigado!\n\nQuando tiver real interesse é só me chamar.`;

// Função para enviar perguntas
async function askQuestion(sock, from, step, isWhatsApp = true) {
    const message = { text: questions[step] };
    if (isWhatsApp) {
        await sock.sendMessage(from, message);
    } else {
        return message.text; // Retorna a pergunta para o widget
    }
}

// Função para qualificar o lead com Ollama
async function qualifyLead(answers) {
    const prompt = `Você é um assistente de IA de um CRM, responsável por avaliar as respostas do usuário e qualificar se ele é um lead qualificado ou não qualificado baseado em suas respostas, não fuja do contexto e se limite a perguntas que são interessantes para qualificar se ele quer ou não comprar um produto.
    
    Analise as seguintes respostas e determine se o lead é "qualificado" ou "não qualificado" em seguida um resumo do motivo que levou a tomar essa decisão.
    1. Nome: ${answers[0]}
    2. Email: ${answers[1]}
    3. Interesse: ${answers[2]}
    4. Pronto para comprar: ${answers[3]}
    5. Orçamento: ${answers[4]}

    Responda com "qualificado" ou "não qualificado" em seguida um resumo do motivo que levou a tomar essa decisão.`;

    try {
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: 'gemma3:1b',
            prompt: prompt,
            stream: false
        });
        console.log('Análise da IA do Ollama:', response.data.response);
        const result = response.data.response.trim().toLowerCase();
        return result.includes('não qualificado') ? { status: 'não qualificado', reason: result } : { status: 'qualificado', reason: result };
    } catch (error) {
        console.error('Erro ao qualificar lead:', error);
        return { status: 'não qualificado', reason: error.message };
    }
}

// Função para conectar ao WhatsApp
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./whatsapp_auth');
    const sock = makeWASocket({
        logger: pino({ level: 'info' }),
        printQRInTerminal: true,
        auth: state,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log('Conexão WhatsApp estabelecida com sucesso!');
        } else if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log('Conexão WhatsApp fechada. Motivo:', reason);
            if (reason !== DisconnectReason.loggedOut) {
                console.log('Tentando reconectar ao WhatsApp...');
                connectToWhatsApp();
            } else {
                console.log('Deslogado do WhatsApp. Remova a pasta "whatsapp_auth" e escaneie o QR code novamente.');
            }
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && msg.message?.conversation) {
            const from = msg.key.remoteJid;
            const text = msg.message.conversation.toLowerCase();

            if (!conversations[from]) {
                conversations[from] = { step: 0, answers: [], platform: 'whatsapp' };
                await sock.sendMessage(from, { text: WELCOME_MESSAGE });
                await askQuestion(sock, from, 0);
            } else {
                conversations[from].answers.push(text);
                conversations[from].step += 1;

                if (conversations[from].step < 5) {
                    await askQuestion(sock, from, conversations[from].step);
                } else {
                    const qualification = await qualifyLead(conversations[from].answers);
                    const leadData = { phone: from, answers: conversations[from].answers, status: qualification.status, reason: qualification.reason, platform: 'whatsapp' };
                    saveToJson(leadData);
                    await sock.sendMessage(from, {
                        text: qualification.status === 'qualificado' ? LEAD_QUALIFIED_MESSAGE : LEAD_NOT_QUALIFIED_MESSAGE
                    });
                    delete conversations[from];
                }
            }
        }
    });

    return sock;
}

// API para o widget de chat
app.post('/chat', async (req, res) => {
    const { userId, message } = req.body;

    if (!conversations[userId]) {
        conversations[userId] = { step: 0, answers: [], platform: 'web' };
        return res.json({
            message: WELCOME_MESSAGE + '\n\n' + await askQuestion(null, userId, 0, false)
        });
    }
    console.log('Resposta do usuário:', message);
    conversations[userId].answers.push(message.toLowerCase());
    conversations[userId].step += 1;

    if (conversations[userId].step < 5) {
        return res.json({
            message: await askQuestion(null, userId, conversations[userId].step, false)
        });
    } else {
        const qualification = await qualifyLead(conversations[userId].answers);
        const leadData = { userId, answers: conversations[userId].answers, status: qualification.status, reason: qualification.reason, platform: 'web' };
        saveToJson(leadData);
        delete conversations[userId];
        return res.json({
            message: qualification.status === 'qualificado' ? LEAD_QUALIFIED_MESSAGE : LEAD_NOT_QUALIFIED_MESSAGE
        });
    }
});

// Iniciar o servidor e o WhatsApp
connectToWhatsApp().catch((err) => console.error('Erro ao iniciar WhatsApp:', err));
app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000. Acesse http://localhost:3000');
});