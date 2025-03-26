import express from 'express';
import crypto from 'crypto';
import bodyParser from 'body-parser';

// Create a super simple app just for validation
const app = express();

// Only parse JSON - no other middleware
app.use(bodyParser.json());

// Validation endpoint
app.post('/validate', function(req, res) {
  console.log('Received validation request', JSON.stringify(req.body));
  
  try {
    // Check if this is a validation request
    if (req.body && req.body.event === 'endpoint.url_validation' && req.body.payload) {
      const plainToken = req.body.payload.plainToken;
      // Use the verification token directly
      const verificationToken = 'xB24LMVcTUyEK8w0t064FQ';
      
      console.log(`Using plain token: ${plainToken}`);
      console.log(`Using verification token: ${verificationToken}`);
      
      // Generate the encrypted token
      const hashAlgorithm = crypto.createHmac('sha256', verificationToken);
      const encryptedToken = hashAlgorithm.update(plainToken).digest('hex');
      
      console.log(`Generated encrypted token: ${encryptedToken}`);
      
      // Send the expected response format
      return res.json({
        plainToken: plainToken,
        encryptedToken: encryptedToken
      });
    } else {
      console.log('Not a validation request');
      return res.json({ status: 'Not a validation request' });
    }
  } catch (error) {
    console.error('Error processing validation:', error);
    return res.status(500).json({ error: 'Validation processing failed' });
  }
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, function() {
  console.log(`Simple validation server running on port ${PORT}`);
});

//