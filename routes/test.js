var fs = require("fs");
var path = require('path');
var async = require("async");

var ci = require("../lib");

exports.file = function(req, res) {

  // ci.ssh.confirm(function(err, data) {
  //   res.send(data);
  // });

  var repo = 'git@github.com:d1b1/d1b1.github.com.git';

  // ci.git.clone('d1b1.site', repo, function(err, data) {
  //   res.send(data);
  // });

  // ci.git.fetch('d1b1.site', function(err, data) {
  //   res.send(data);
  // });

  ci.git.deploy('d1b1.site', 'heroku', function(err, data) {
    res.send(data);
  });

}
