const axios = require('axios');

const API_KEY = 'sk-cp-5PmsqTMAiCsMWz265EaeX3bva_NFJ2U-e26wRcgzhwKxAqS_Nv2o9jtTm1OB8CVafm755S7O25LMdfD3-NogbHXDfhZtSPEzO1UftmqJaNvpz6YedgVZV4c';

async function test() {
  const endpoints = [
    { url: 'https://api.minimax.chat/v1/text/chatcompletion_v2', name: 'api.minimax.chat/v1' },
    { url: 'https://api.minimax.cn/v1/text/chatcompletion_v2', name: 'api.minimax.cn/v1' },
    { url: 'https://api.minimax.cn/v1/text/chatcompletion_pro', name: 'api.minimax.cn/v1/pro' },
    { url: 'https://api.minimax.chat/v1/text/chatcompletion_pro', name: 'api.minimax.chat/v1/pro' },
  ];

  const models = ['abab6.5s-chat', 'abab6-chat', 'MiniMax-Text-01'];

  for (const { url, name } of endpoints) {
    for (const model of models) {
      try {
        const { data } = await axios.post(url, {
          model,
          messages: [{ role: 'user', content: 'Say hello in Chinese' }],
          max_tokens: 50,
        }, {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 12000,
        });
        console.log(`SUCCESS! ${name} model=${model}`);
        console.log(JSON.stringify(data).substring(0, 300));
        process.exit(0);
      } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.error?.message || err.message;
        if (status) {
          console.log(`FAIL [${status}] ${name} model=${model}: ${msg}`);
        }
      }
    }
  }
  console.log('All endpoints failed');
}

test();
