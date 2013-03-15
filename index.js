"use strict";

var Client = module.exports = function(config) {

  this.apikey = config.apikey;
  this.host   = "api.ipinfodb.com";
};

(function() {
 
  this.get = function(id, cb) {

    var options = {
      host:    this.host,
      path:    'v3/ip-city/?key=' + this.apikey ,
      method:  'GET',
      // headers: {
      //   'api_key': 'guest-key'
      // }
    });

    console.log(id, options);
    // var call = http.request(options, function(result) {
    //   result.setEncoding('utf8');
    //   var chunkData = '';
    //   result.on('data', function(chunk) { chunkData = chunkData + chunk; });
    //   result.on('end', function() {
    //     var data = JSON.parse(chunkData);
    //     if (result.statusCode == 404) return cb(null, null);
    //     if (result.statusCode == 500) return cb({ message: 'Error accessing this information' }, null);
    //     cb(null, data);
    //   });
    // });

    // call.on('error', function(err) { cb(err, null ); });
    // call.end();

    // http://api.ipinfodb.com/v3/ip-city/?key=9730aa0c8b5c67b560947f664bf9c4f5128a3b81b0ff6f3f0f16dca1bea46fcb&ip=213.243.4.20&format=json

    cb(null, 'heree');
  }

}).call(Client.prototype);