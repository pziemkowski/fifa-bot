import * as functions from 'firebase-functions';
import admin from 'firebase-admin';

process.env.DEBUG = 'dialogflow:debug';

admin.initializeApp(functions.config().firebase);

const { dialogflowFirebaseFulfillment, oauthSuccessPage } = require('./http/index');

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(dialogflowFirebaseFulfillment);

exports.oauthSuccessPage = functions.https.onRequest(oauthSuccessPage);
