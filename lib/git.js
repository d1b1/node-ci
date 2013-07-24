var ci = module.parent;

// TODO: Parse the STError and SDOut into better objects.
// TODO: Parse the git remote URL into a repo name. Need a class for this.
// TODO: Attach these to a prototype for the git object.

exports.clone = function(name, repo, done) {

  var pdir = "/Users/steve/Dropbox/github/rand/tmp";
  var cmd = "git clone " + repo + " " + pdir + "/" + name + ";"; 

  var gitcb = function (error, stdout, stderr) { 
    console.log("error", error);
    console.log("stdout", stdout);
    console.log("stderr", stderr);
    done(null, { command: cmd, message: "Git Clone from Source.", stdout: stdout, output: arguments});
  }

  var exec = require("child_process").exec;
  exec(cmd, gitcb);
  
}

exports.fetch = function(name, done) {

  var pdir = "/Users/steve/Dropbox/github/rand/tmp";
  var cmd = "GIT_WORK_TREE=" + pdir + "/" + name + " git fetch origin;"; 

  var gitcb = function (error, stdout, stderr) { 
    console.log("error", error);
    console.log("stdout", stdout);
    console.log("stderr", stderr);
    done(null, { command: cmd, message: "Git Fetch from Origin.", stdout: stdout, output: arguments});
  }

  var exec = require("child_process").exec;
  exec(cmd, gitcb);

}

exports.deploy = function(name, app, done) {

  var pdir = "/Users/steve/Dropbox/github/rand/tmp";
  var cmd = "GIT_WORK_TREE=" + pdir + "/" + name + " git push " + app + " origin/master:master --force"; 

  var gitcb = function (error, stdout, stderr) { 
    console.log("error", error);
    console.log("stdout", stdout);
    console.log("stderr", stderr);
    done(null, { command: cmd, message: "Deploying to remote (Heroku).", stdout: stdout, output: arguments});
  }

  var exec = require("child_process").exec;
  exec(cmd, gitcb);

}