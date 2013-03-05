var mongodb    = require('mongodb');

DbManager = (function() {

  var enabled_auth = true;

  var mongoCon = require('url').parse( process.env.NODE_CI_MONGO_URI );

  mongoCon.auth_ex = mongoCon.auth.split(':');
  var _dbname = mongoCon.auth_ex[0];
  var _dbUser = mongoCon.auth_ex[0];
  var _dbPass = mongoCon.auth_ex[1];

  var _server = new mongodb.Server(mongoCon.hostname, parseInt(mongoCon.port), { safe: false });
  var db     = new mongodb.Db(_dbname, _server, { native_parser: true });

  return {
    getDb: function() {
      return db;
    },
    authenticate: function(client, cb) {
      if (enabled_auth) {
        client.authenticate( _dbUser, _dbPass, function(err, success) { 
          cb(client)
        });
      } else {
        cb(client);
      }
    }
  }
})();

exports.DbManager = DbManager;