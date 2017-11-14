const { ifElse, pathEq } = require('ramda');

module.exports = type => fn => ifElse(
  pathEq(['body', 'type'], type),
  fn,
  (req, res, next) => next()
);
