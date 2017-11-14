const functions = require('firebase-functions');
const express = require('express');
const { OK, UNAUTHORIZED } = require('http-status');

const app = express();
const router = express.Router();

const parsePayload = (req, res, next) => {
  req.body = JSON.parse(req.body.payload);
  next();
};

const validateToken = (req, res, next) => {
  const { token } = req.body;
  if (token !== functions.config().slack.verification_token) {
    return res.status(UNAUTHORIZED).send('');
  }
  console.log(req.body);

  return next();
};

router.use(parsePayload);
router.use(validateToken);

router.use((req, res) => {
  res.status(OK).send('');
});

app.post('/', router);

module.exports = app;
