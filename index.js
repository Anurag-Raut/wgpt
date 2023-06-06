require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);
const { Configuration, OpenAIApi } = require('openai');

const { ocrSpace } = require('ocr-space-api-wrapper');

async function displayError(error){
  console.log(error);
  
}
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));

app.post('/sms', async (req, res) => {
  

  var message = req.body.Body;
  console.log(req.body.From);

  if (req?.body?.NumMedia > 0) {
    const mediaUrl = req.body.MediaUrl0;
    console.log(mediaUrl);
    try {
      const a = await ocrSpace(mediaUrl, { apiKey: process.env.OCR_SPACE_API_KEY });
      message = a.ParsedResults[0].ParsedText;
      await client.messages.create({
        body: message,
        from: 'whatsapp:' + process.env.TWILIO_PHONE_NUMBER,
        to: req.body.From,
      });
      
    } catch (error) {
      displayError(error)
    }
  }
  

  openai
    .createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: message }],
    })
    .then(async (completion) => {
      const modelResponse = completion.data.choices[0].message.content;
      const totalChunks = Math.ceil(modelResponse.length / 1500);
      for (let i = 0; i < totalChunks; i++) {
        const start = i * 1500;
        const end = start + 1500;
        const chunk = modelResponse?.substring(start, end);
      
        Promise.all(
          await client.messages.create({
            body: chunk,
            from: 'whatsapp:' + process.env.TWILIO_PHONE_NUMBER,
            to: req.body.From,
          })
        )
        
      }
    })
    .catch((error) => {
      displayError(error)
    });
});

app.listen(3000, () => {
  console.log('WhatsApp bot server is running on port 3000');
});
