require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);
const { Configuration, OpenAIApi } = require('openai');

const { ocrSpace } = require('ocr-space-api-wrapper');

async function displayError(error) {
  console.error(error);
  await client?.messages?.create({
    body: error,
    from: 'whatsapp:' + process.env.TWILIO_PHONE_NUMBER,
    to: req.body.From,
  });
}

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const { MessagingResponse } = require('twilio').twiml;
const openai = new OpenAIApi(configuration);
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));

app.post('/sms', async (req, res) => {
  const twiml = new MessagingResponse();

  var message = req.body.Body;
  console.log('Incoming Message:', message);
  console.log('From:', req.body.From);

  if (req?.body?.NumMedia > 0) {
    const mediaUrl = req.body.MediaUrl0;
    console.log('Media URL:', mediaUrl);
    try {
      const a = await ocrSpace(mediaUrl, { apiKey: process.env.OCR_SPACE_API_KEY });
      message = a.ParsedResults[0].ParsedText;
      console.log('OCR Result:', message);

      await client.messages.create({
        body: message,
        from: 'whatsapp:' + process.env.TWILIO_PHONE_NUMBER,
        to: req.body.From,
      });
    } catch (error) {
      displayError(error);
    }
  }

  openai
    .createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: message }],
    })
    .then(async (completion) => {
      const modelResponse = completion.data.choices[0].message.content;
      console.log('Model Response:', modelResponse);
      const totalChunks = Math.ceil(modelResponse.length / 1600);
      console.log('Total Chunks:', totalChunks);

      await client.messages.create({
        body: `${modelResponse.length}`,
        from: 'whatsapp:' + process.env.TWILIO_PHONE_NUMBER,
        to: req.body.From,
      });

      for (let i = 0; i < totalChunks; i++) {
        const start = i * 1600;
        const end = start + 1600;
        const chunk = modelResponse?.substring(start, end);
        console.log('Chunk:', chunk);

        await client.messages.create({
          body: chunk,
          from: 'whatsapp:' + process.env.TWILIO_PHONE_NUMBER,
          to: req.body.From,
        });
      }
    })
    .catch((error) => {
      displayError(error);
    });
});

app.listen(3000, () => {
  console.log('WhatsApp bot server is running on port 3000');
});
