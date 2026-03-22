const axios = require('axios');

const KEY = process.env.MINIMAX_API_KEY;
if (!KEY) {
  console.error('MINIMAX_API_KEY missing');
  process.exit(1);
}

async function test(model) {
  try {
    const { data } = await axios.post(
      'https://api.minimaxi.com/v1/chat/completions',
      {
        model,
        messages: [{ role: 'user', content: '你好，请回复：ok' }],
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    console.log('SUCCESS', model);
    console.log(JSON.stringify(data).slice(0, 500));
  } catch (err) {
    console.log('FAIL', model, err.response?.status || err.code || err.message);
    if (err.response?.data) console.log(JSON.stringify(err.response.data).slice(0, 500));
  }
}

(async () => {
  await test('MiniMax-M2.7-highspeed');
  await test('MiniMax-M2.5');
})();
