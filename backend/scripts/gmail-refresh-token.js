const http = require('http');
const { google } = require('googleapis');

const CLIENT_ID = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || '';
const PORT = Number(process.env.GMAIL_TOKEN_PORT || 53682);
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET.');
  console.error('Run this from backend with those env vars set, then try again.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, REDIRECT_URI);
    if (url.pathname !== '/oauth2callback') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const code = url.searchParams.get('code');
    if (!code) throw new Error(url.searchParams.get('error') || 'Missing authorization code.');
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('OK. You can close this tab and return to the terminal.');
    console.log('\nAdd these variables to Render:');
    console.log('MAIL_MODE=gmail_api');
    console.log('GMAIL_CLIENT_ID=' + CLIENT_ID);
    console.log('GMAIL_CLIENT_SECRET=' + CLIENT_SECRET);
    console.log('GMAIL_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('\nKeep GMAIL_SENDER_EMAIL as the Gmail account you approved.');
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(error.message);
    console.error(error.message);
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log('Before opening the URL, add this redirect URI in Google Cloud OAuth client:');
  console.log(REDIRECT_URI);
  console.log('\nOpen this URL, choose the sending Gmail account, and approve Gmail send permission:\n');
  console.log(authUrl);
});
