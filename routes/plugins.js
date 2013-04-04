var db         = require('../db');
var mongodb    = require('mongodb');
var util       = require('./util');
var async      = require('async');
var moment     = require('moment');
var _          = require('underscore');

exports.list = function(req, res) {

  var t1 = require('../plugins/sample1/package.json');
  var t2 = require('../plugins/sample2/package.json');

  console.log(t1);

  var data = [
    t1,
    t2
  ];

  res.render('plugins', { data: data });
}