const fs = require('fs');
const path = require('path');

const googleServices = process.env.GOOGLE_SERVICES_JSON;
if (!googleServices) {
  throw new Error('GOOGLE_SERVICES_JSON env variable not set');
}

const filePath = path.join(__dirname, '../android/app/google-services.json');
fs.writeFileSync(filePath, googleServices);
console.log('google-services.json generated!');
