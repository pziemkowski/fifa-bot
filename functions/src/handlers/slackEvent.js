const functions = require('firebase-functions');
const express = require('express');
const { OK, UNAUTHORIZED } = require('http-status');

const { urlVerification, event } = require('../slackCallbacks/index');

const app = express();
const router = express.Router();

const validateToken = (req, res, next) => {
  const { token } = req.body;
  if (token !== functions.config().slack.verification_token) {
    return res.status(UNAUTHORIZED).send('');
  }

  return next();
};

router.use(validateToken);
router.use(urlVerification);
router.use(event);

router.use((req, res) => {
  res.status(OK).send('');
});

app.post('/', router);

module.exports = app;

