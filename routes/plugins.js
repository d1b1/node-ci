var db         = require('../db');
var mongodb    = require('mongodb');
var util       = require('./util');
var async      = require('async');
var moment     = require('moment');
var _          = require('underscore');

var CIServer = require('./CIServer');
var CI = new CIServer();



exports.list = function(req, res) {

  var t1 = require('../plugins/sample1/package.json');
  var t2 = require('../plugins/sample2/package.json');

  var data = [
    t1,
    t2
  ];

  res.render('plugins', { data: data });
}

exports.start = function(req, res) {

  // TODO Need to register 
  var plugin1 = require('../plugins/sample1/app.js').Plugin1;
  plugin1.start(CI);

  var plugin2 = require('../plugins/sample2/app.js').Plugin2;
  plugin2.start(CI);

  CI.emit('prebuild', 'CRAP');
  CI.emit('postbuild', 'CRAP');

  res.send('Starting the plugins')
}

exports.ping = function(req, res) {

  CI.emit('prebuild', 'asd');
  
  res.send('here')
}

