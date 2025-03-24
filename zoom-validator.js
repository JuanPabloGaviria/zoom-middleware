const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Zoom
const ZOOM_VERIFICATION_TOKEN = 'oChR-fw_R3aoNjSuapD6Qw';
const N8N_WEBHOOK_URL = 'https://jpgaviria.app.n8n.cloud/webhook/zoom-webhook';

app.use(bodyParser.json());

app.post('/zoom-webhook', async (req, res) => {
  console.log('Webhook recibido:', JSON.stringify(req.body));
  
  // Si es una solicitud de validación de URL
  if (req.body.event === 'endpoint.url_validation') {
    const plainToken = req.body.payload.plainToken;
    
    // Crear la firma HMAC SHA-256
    const hashAlgorithm = crypto.createHmac('sha256', ZOOM_VERIFICATION_TOKEN);
    const encryptedToken = hashAlgorithm.update(plainToken).digest('hex');
    
    console.log('Procesando validación con tokens:', { plainToken, encryptedToken });
    
    // Enviar respuesta de validación a Zoom
    return res.status(200).json({
      plainToken: plainToken,
      encryptedToken: encryptedToken
    });
  }
  
  // Para otros eventos, reenviarlos a n8n
  try {
    console.log('Reenviando evento a n8n:', req.body.event);
    await axios.post(N8N_WEBHOOK_URL, req.body);
    res.status(200).send('Event forwarded to n8n');
  } catch (error) {
    console.error('Error forwarding to n8n:', error);
    res.status(200).send('Received but failed to forward');
  }
});

app.listen(PORT, () => {
  console.log(`Zoom webhook validator running on port ${PORT}`);
});