var http = require('http');
var _    = require('underscore');

exports.trigger = function(req, res) {

  var id     = req.params.id;
  var branch = req.params.branch;

  var query = { _id: new mongodb.ObjectID(id) };
  var collection = new mongodb.Collection(DbManager.getDb(), 'repos');
  collection.findOne(query, function(err, result) {
    if (err) return;

    buildPage(result);
  });

  var buildPage = function(repoData) {

    var data = {
        repository: { 
          name: repoData.repo, 
          url:  repoData.url 
        }, 
        ref: 'refs/heads/' + branch 
      };

    data = { payload: JSON.stringify(data) };

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

}