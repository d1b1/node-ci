// This is a test start script. Not sure if this is the best way.

var forever = require('forever');
var path    = require('path');

var logfile = path.resolve( __dirname, 'logs' ) + '/proc_manager.log';
var errfile = path.resolve( __dirname, 'logs' ) + '/proc_manager_err.log';
var outfile = path.resolve( __dirname, 'logs' ) + '/proc_manager_out.log';

var options = { 
  killTree: false,
  logFile:   logfile,
  errFile:   errfile,
  outFile:   outfile,
  append:    true,
  sourceDir: __dirname,
  
  //
  ui_type:  'ci', 
  ui_sha:   'NA', 
  ui_desc:  'This is the Node-CI Manager. Love it, love it.', 
  ui_name:  'Node-CI', 
  ui_owner: 'd1b1',
  ui_port:  3005
};

var mainProcess   = forever.start(["node", "web.js"], options);

mainProcess.on("stdout", function(data) {
  console.log(data.toString().trim());
});

mainProcess.on("stderr", function(data) {
  console.log(data.toString().trim());
});

forever.startServer(mainProcess);