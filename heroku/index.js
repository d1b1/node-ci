var Braque = require("braque");

var heroku = new Braque({
  version: "2.0.0",
  routeFile: "./heroku/heroku.json",

  // Use callbacks to provide access to the request before it is send.
  callbacks: {
	  header: function(headers) {
	  	headers.Accept= "application/vnd.heroku+json; version=3";
	  }
	}
});

heroku.authenticate({
  type: "custom",
  token: process.env.HEROKU_API,
  custom: function(res) {
  	return "Basic " + new Buffer(":" + (process.env.HEROKU_API)).toString('base64');
  }
});

module.exports = heroku;

