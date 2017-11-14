const functions = require('firebase-functions');
const admin = require('firebase-admin');

const serviceAccount = require("./service_account.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://fifa-bot-e89db.firebaseio.com"
});

exports.slackEvent = functions.https.onRequest(require('./src/handlers/slackEvent'));

exports.slackMessageAction = functions.https.onRequest(require('./src/handlers/slackMessageAction'));

