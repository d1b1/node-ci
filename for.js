var forever = require('forever');

var mainProcess   = forever.start(["node", "web.js"], {max: 1, silent: true});
mainProcess.on("stdout", function(data) {
  console.log(data.toString().trim());
});
mainProcess.on("stderr", function(data) {
  console.log(data.toString().trim());
});
forever.startServer(mainProcess);