const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const port = process.env.PORT || 3337;

app.use(bodyParser.json());
app.use(cors());

app.post('/api/webhook/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  try {
    const response = await axios.post(
      `https://parceiro.painelw.com.br/api/oimed/webhook/${id}`,
      body,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => { // Listen on port 3000 
    console.log(`Listening! in port: ${port}`); // Log when listen success 
});
