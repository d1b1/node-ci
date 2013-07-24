var fs = require("fs")
    , path = require('path')
    , async = require("async");

// This function will attempt to find, and or create
// a local SSH file for use by git in its github calls.

exports.confirm = function(done) {

  var dirpath = __dirname + "/../.ssh";
  var sshfile = dirpath + "/id_rsa.pub";

  // First check that we have the defined process.env variable.
  if (!process.env.SSH_CERT) {
  	var result = { hasSSHCert: { status: false, message: "NO SSH_CERT variable found. "} };
    return done(null, { status: false, result: result });
  }

  async.series({
  	checkFolder: function(callback) {
	  if (path.existsSync(dirpath)) {
		callback(null, "Folder Exists");
	  } else {
		fs.mkdir(dirpath, function() {
          callback(null, "Folder Created."); 
		});
	  }
  	},
  	checkFile: function(callback) {
	  if (path.existsSync(sshfile)) {
		callback(null, { status: true, message: "File Exists" });
	  } else {
		fs.writeFile(sshfile, process.env.SSH_CERT, function(err) {
		  if(err) return callback(err)
		  callback(err, { status: true, message: "File Created."});
		}); 
	  }
  	}
  }, function(err, result) { 
    var status = result.checkFile ? result.checkFile.status : false;
    done(err, { status: status, result: result } );
  });

}