var fs = require("fs");
var path = require('path');

exports.file = function(req, res) {
	
  var dirpath = __dirname + '/mytestFolder';

  if (path.existsSync(dirpath)) {
	res.send('File Exists')
  } else {

	fs.mkdir(path, function(err) {
	  console.log('args', arguments);
	  res.send(arguments)
	});

  }
  
}