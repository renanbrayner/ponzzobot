# Bot de Kick por Inatividade de Voz

Bot Discord que monitora canais de voz e automaticamente remove usuários que não falam dentro de um período configurável. Usa detecção avançada de atividade de voz (VAD) para evitar falsos positivos.

## 🎯 Funcionalidades

- Monitoramento em tempo real de canais de voz
- Detecção avançada de atividade de voz (VAD)
- Sistema de elegibilidade (usuário só pode ser kickado uma vez por sessão)
- Áudio de contagem regressiva ao agendar kick
- Configuração completa via variáveis de ambiente
- Logs detalhados para调试 e calibração

## 📋 Pré-requisitos

- Node.js 16+
- Conta de bot Discord com permissões adequadas
- `MESSAGE CONTENT INTENT` habilitado no Developer Portal

## 🚀 Instalação

1. **Clone o repositório**
   ```bash
   git clone <URL-DO-REPOSITORIO>
   cd deznoveoito
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure o ambiente**
   ```bash
   cp .env.example .env
   # Edite .env com suas configurações
   ```

4. **Execute o bot**
   ```bash
   npm start
   ```

## ⚙️ Configuração

### 1. Criar o Bot Discord

1. Vá para [Discord Developer Portal](https://discord.com/developers/applications)
2. Crie uma nova aplicação → Bot
3. Habilite **MESSAGE CONTENT INTENT** em *Privileged Intents*
4. Copie o token para `.env`

### 2. Convidar o Bot

1. Em OAuth2 → URL Generator, selecione:
   - `bot`
   - `applications.commands`
2. Permissões necessárias:
   - **Move Members** (essencial para desconectar usuários)
   - **Connect** (entrar em canais de voz)
   - **Speak** (tocar áudio de contagem)
   - **Read Messages/View Channels**
   - **Send Messages**
3. Use o URL gerado para convidar ao servidor

### 3. Variáveis de Ambiente

```bash
# Token do bot (obrigatório)
DISCORD_TOKEN=seu_token_aqui

# Tempo de inatividade para kick (ms)
INACTIVITY_TIMEOUT=2000

# Parâmetros VAD (Detecção de Atividade de Voz)
VAD_THRESHOLD=4000          # Acima disso é potencial fala
VAD_FLOOR=1500             # Abaixo disso é ruído ignorado
VAD_SUSTAIN_MS=150         # Tempo contínuo acima do threshold
VAD_COOLDOWN_MS=400        # Cooldown pós-confirmação
VAD_THRESHOLD_STRONG=6000  # Fala forte = cancelamento imediato
```

## 🎮 Comandos

- `!entrar` - Bot entra no canal de voz atual
- `!sair` - Bot sai do canal de voz atual

## 🔧 VAD (Detecção de Atividade de Voz)

O bot usa um algoritmo VAD sofisticado com múltiplas camadas:

### Como Funciona

1. **Análise RMS** - Mede o volume do áudio em tempo real
2. **Média Móvel** - Suaviza leituras com janela de 3 frames
3. **Detecção por Limiares** - múltiplos níveis de sensibilidade
4. **Verificação de Sustentação** - exige fala contínua
5. **Análise de Proporção** - % de frames acima do threshold

### Parâmetros VAD Explicados

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `VAD_FLOOR` | 1500 | Abaixo disso = ruído ignorado |
| `VAD_THRESHOLD` | 4000 | Acima disso = potencial fala |
| `VAD_THRESHOLD_STRONG` | 6000 | Fala muito forte = cancela imediatamente |
| `VAD_SUSTAIN_MS` | 150 | Tempo mínimo de fala contínua |
| `VAD_COOLDOWN_MS` | 400 | Tempo de espera após detecção |

### Calibração

Use os logs `[VADDBG]` para calibrar:
```bash
# Exemplo de log para calibração
[VADDBG] Usuario avgRMS=3200
```

- Se o bot não detecta fala: diminua `VAD_THRESHOLD`
- Se o bot detecta ruído: aumente `VAD_FLOOR` e `VAD_THRESHOLD`

## 📁 Estrutura do Projeto

```
deznoveoito/
├── index.js              # Código principal do bot
├── package.json          # Dependências e scripts
├── .env                  # Configurações (não commitar)
├── .gitignore           # Arquivos ignorados pelo git
├── assets/
│   └── contagem.ogg     # Áudio tocado ao agendar kick
└── README.md            # Esta documentação
```

## 🔍 Logs e Debug

O bot fornece logs detalhados para troubleshooting:

- `[voice]` - Eventos de conexão de voz
- `[VAD]` - Detecções de fala confirmadas
- `[VADDBG]` - Valores RMS para calibração
- `[eligibility]` - Mudanças de elegibilidade
- `[kick-cancel]` - Kicks cancelados

## 🛠️ Troubleshooting

### Problemas Comuns

**Bot não responde comandos:**
- Verifique se `MESSAGE CONTENT INTENT` está habilitado
- Confirme se o bot tem permissão `Send Messages`
- Verifique o token no `.env`

**Erro de criptografia:**
- Execute `npm install sodium-native`
- Reinicie o bot

**Bot não entra no canal:**
- Verifique permissão `Connect` e `Speak`
- Confirme se o bot tem `Move Members`

**VAD muito sensível:**
- Aumente `VAD_THRESHOLD` para 4500-5000
- Aumente `VAD_FLOOR` para 2000

**VAD não detecta fala:**
- Diminua `VAD_THRESHOLD` para 3000-3500
- Diminua `VAD_SUSTAIN_MS` para 100

### Logs Úteis

```bash
# Para ver logs em tempo real
node index.js

# Logs de calibração VAD
grep "\[VADDBG\]" log_output.txt
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie feature branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para branch (`git push origin feature/nova-funcionalidade`)
5. Abra Pull Request

## 📝 Licença

MIT License - ver arquivo LICENSE para detalhes

## 🔧 Desenvolvimento

### Scripts Disponíveis
```bash
npm start    # Inicia o bot
npm run dev  # Modo desenvolvimento (mesmo que start)
```

### Dependências Principais
- `discord.js` - API Discord
- `@discordjs/voice` - Funcionalidades de voz
- `prism-media` - Processamento de áudio
- `dotenv` - Gerenciamento de variáveis de ambiente
- `sodium-native` - Criptografia de voz

### Notas Técnicas

- O bot só kicka usuários no mesmo canal de voz que ele
- Cada usuário só pode ser kickado uma vez por sessão (até sair/entrar)
- O áudio `contagem.ogg` é tocado quando um kick é agendado
- Todos os tempos são em milissegundos
- O bot suporta múltiplos servidores simultaneamente