var ci = module.parent;

exports.start = function(done) {

  // First we need to confirm taht we have the reqjuired SSH elements.

  ci.ssh.confirm(function(err, data) {
  	done(err, data.status);
  });

}

exports.isReady = function(done) {

  // Has tmp folder.
  // Has the cloned folder.
  // Has the team setup

  done(null, true);
}