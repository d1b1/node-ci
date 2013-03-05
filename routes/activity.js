var util     = require('./util');
var _        = require('underscore');
var db       = require('../db');
var mongodb  = require('mongodb');
var moment   = require('moment');

exports.list = function(req, res) {

  var dbClient = DbManager.getDb();
  var query = {};

  var options = {
    "sort": [['timestamp','desc']]
  };

  var collection = new mongodb.Collection(DbManager.getDb(), 'logs');
  collection.find(query, options).toArray(function(err, data) {
    if (err || !data) {
      cb(null, 'No Episiodes found.');
      return
    }

    res.render('activity', { data: data });
  });

}

exports.delete = function(req, res) {

  var query = {
    _id: new mongodb.ObjectID( req.params.id.toString() )
  };

  var collection = new mongodb.Collection(DbManager.getDb(), 'logs');
  collection.remove(query, { safe: true }, function(err, removeCount) {}); 

  res.redirect('/activity');

}