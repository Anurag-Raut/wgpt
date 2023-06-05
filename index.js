require('dotenv').config();
const axios = require('axios');
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);
const { Configuration, OpenAIApi } = require('openai');
const { ocrSpace } = require('ocr-space-api-wrapper');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

module.exports = async (req, res) => {
  try {
    const { Body, From, NumMedia, MediaUrl0 } = req.body;
    console.log('Incoming Message:', Body);
    console.log('From:', From);

    if (NumMedia > 0) {
      console.log('Media URL:', MediaUrl0);
      const a = await ocrSpace(MediaUrl0, { apiKey: process.env.OCR_SPACE_API_KEY });
      const message = a.ParsedResults[0].ParsedText;
      console.log('OCR Result:', message);

      await client.messages.create({
        body: message,
        from: 'whatsapp:' + process.env.TWILIO_PHONE_NUMBER,
        to: From,
      });
    }

    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: Body }],
    });

    const modelResponse = completion.data.choices[0].message.content;
    console.log('Model Response:', modelResponse);
    const totalChunks = Math.ceil(modelResponse.length / 1600);
    console.log('Total Chunks:', totalChunks);

    await client.messages.create({
      body: `${modelResponse.length}`,
      from: 'whatsapp:' + process.env.TWILIO_PHONE_NUMBER,
      to: From,
    });

    for (let i = 0; i < totalChunks; i++) {
      const start = i * 1600;
      const end = start + 1600;
      const chunk = modelResponse?.substring(start, end);
      console.log('Chunk:', chunk);

      await client.messages.create({
        body: chunk,
        from: 'whatsapp:' + process.env.TWILIO_PHONE_NUMBER,
        to: From,
      });
    }

    res.status(200).send('Success');
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
};
