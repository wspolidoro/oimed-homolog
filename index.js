const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const port = process.env.PORT || 3035;
const rout = require('./routs/Routes');
const routerApi = require('./api/api');
const routerSandbox = require('./api/sandbox');

//debbug
const sendMailError = require('./routs/sendMailer.js');

//docs
const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('./swagger.json');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(cors());

app.use(bodyParser.json());
// Express modules / packages 

app.use(bodyParser.urlencoded({ extended: true }));
// Express modules / packages 

app.use('/', rout);

app.get('/mailerr', async(req, res) => {
    
    let sending = await sendMailError(req.query.id, "Vida não cadastrada na RD");
    if(sending) {
        res.json({success: true, message: "Email enviado!"})
    }
    

});

app.use('/api', routerApi);
app.use('/sandbox', routerSandbox);


app.listen(port, () => { // Listen on port 3000 
    console.log(`Listening! in port: ${port}`); // Log when listen success 
});

