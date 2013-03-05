var mongodb = require('mongodb');
var url     = require('url');

var GlobalClient;

// Simple wrapper that give the web.js access to the 
// MongoDB driver without the need to require.

exports.mongodb = mongodb;

// This function will return a DB Connection.
exports.db2 = function(callback_function) {
  
 if (!GlobalClient) {

  // Get the MongoLab URI
  var mongoLab = url.parse(process.env.NODE_CI_MONGOLAB_URI);

  // Split the auth information.
  mongoLab.auth_ex = mongoLab.auth.split(':');

  var server = new mongodb.Server( mongoLab.hostname, parseInt(mongoLab.port), { safe: false });
  var DB = new mongodb.Db(mongoLab.auth_ex[0], server, {});
    DB.open(function (error, client) {
      client.authenticate( mongoLab.auth_ex[0], mongoLab.auth_ex[1], function(err, success) {
        if (err) {
          console.log("There was an error opening the db: " + err);
        } else {
          GlobalClient = client;
          callback_function(GlobalClient);
        }
      });
    });
  } else {
    callback_function(GlobalClient);
  }

};