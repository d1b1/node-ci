var db         = require('../db');
var mongodb    = require('mongodb');
var util       = require('./util');
var async      = require('async');

exports.setup = function(req, res) {
  
  var query = {};
  var collection = new mongodb.Collection(DbManager.getDb(), 'settings');
  collection.findOne(query, function(err, result) {
    if (err) return;

    if (!result) {
      result = {
        _id:    null,
        title:  'Node-CI',
        teamID: ''
      };

    }
    res.render('settings.jade', { data: result });
  });

}

exports.update = function(req, res) {

  var data = {
    title:   req.body.title || 'Node-CI',
    teamID:  req.body.teamID
  };

  if (!req.body.id) {

    var collection = new mongodb.Collection(DbManager.getDb(), 'settings');
    collection.insert(data, { safe: true}, function(err, result) {
      res.redirect('/setup');
    });

  } else {

    var query = { _id: new mongodb.ObjectID(req.body.id) };
    var collection = new mongodb.Collection(DbManager.getDb(), 'settings');
    collection.findAndModify(query, 
      [ ['_id','asc'] ], 
      { $set : data }, 
      { safe: true, new: true }, 
      function(err, result) {
         res.redirect('/setup');
      });
  }

}
