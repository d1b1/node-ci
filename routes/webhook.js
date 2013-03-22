var http = require('http');
var _    = require('underscore');

exports.trigger = function(req, res) {

  var branch = req.params.branch;

  var data = {
    payload: JSON.stringify({ ref: 'refs/heads/' + branch })
  };

  var jsonData = JSON.stringify(data);

  var options = {
    host: 'local.node.ci',
    port: 3005,
    path: '/build',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': jsonData.length
    }
  };

  var call = http.request(options, function(result) {
    result.setEncoding('utf8');
    var chunkData = '';
    result.on('data', function(chunk) { chunkData = chunkData + chunk; });
    result.on('end', function() {
      console.log('Got a response from the webhook handler', data);
    });
  });

  call.on('error', function(err) { 
    console.log('Error in webhook handler', err);
  });

  call.write(jsonData);
  call.end();

  res.redirect('/');

}