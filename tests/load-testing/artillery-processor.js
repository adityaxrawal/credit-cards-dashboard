module.exports = {
  generateRandomTransaction: function (context, events, done) {
    context.vars.merchantName = `Merchant ${Math.floor(Math.random() * 1000)}`;
    context.vars.amount = (Math.random() * 1000 + 10).toFixed(2);
    return done();
  },

  logResponse: function (requestParams, response, context, ee, next) {
    if (response.statusCode >= 400) {
      console.error(`Error: ${response.statusCode} - ${requestParams.url}`);
    }
    return next();
  },
};
