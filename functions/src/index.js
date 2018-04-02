import * as functions from 'firebase-functions';
import admin from 'firebase-admin';

admin.initializeApp(functions.config().firebase);

const { dialogflowFirebaseFulfillment, oauthSuccessPage } = require('./httpTriggers/index');
const { updateRoomMessage } = require('./dbTriggers');

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(dialogflowFirebaseFulfillment);

exports.oauthSuccessPage = functions.https.onRequest(oauthSuccessPage);

exports.updateRoomMessage = functions.database.ref('/roomMembers/{roomId}/').onWrite(updateRoomMessage);
