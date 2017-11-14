const handleWhen = require('./handleWhen');
const { URL_VERIFICATION_CALLBACK } = require('./types');

const handleCallback = handleWhen(URL_VERIFICATION_CALLBACK);

module.exports = handleCallback((req, res, next) => {
  const { body } = req;
  const { challenge } = body;

  return res.status(200).send(challenge);
});
