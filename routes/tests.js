var db         = require('../db');
var mongodb    = require('mongodb');
var util       = require('./util');
var async      = require('async');

exports.list = function(req, res) {

  async.parallel({
    tests: function(callback) {

      var query = {};
      var collection = new mongodb.Collection(DbManager.getDb(), 'tests');
      collection.find(query).toArray(function(err, results) {
        if (err) return;

        callback(null, results);
      });

    }
  }, function(err, results) {

    res.render('tests', { tests: results.tests });

  });

}

exports.add = function(req, res) {

  var data = {
    name: '',
    notes: '',
    steps: '',
    status: 'Pending',
    claimedby: ''
  };

  res.render('test_edit', { data: data, test_id: null });
}

exports.edit = function(req, res) {
  
  var id = req.params.id;
  var query = { _id: new mongodb.ObjectID(id) };

  var collection = new mongodb.Collection(DbManager.getDb(), 'tests');
  collection.findOne(query, function(err, result) {
    if (err) return;

    if (!result.configurations) result.configurations = [];

    res.render('test_edit', { data: result, test_id: id });
  });

}

exports.update = function(req, res) {

  var test_id = req.body.test_id;

  var data = {
    name:     req.body.name || 'No Name',
    notes:    req.body.notes,
    steps:    req.body.steps,
    priority: req.body.priority,
    status:   req.body.status,
    claimedby: req.body.claimedby
  };

  if (!test_id) {

    var collection = new mongodb.Collection(DbManager.getDb(), 'tests');
    collection.insert(data, { safe: true}, function(err, result) {
      if (err) {
        console.log(err);
      };
      console.log('Insert', result)
    });

    res.redirect('/tests');
  } else {

    var query = { _id: new mongodb.ObjectID( test_id ) };

    var collection = new mongodb.Collection(DbManager.getDb(), 'tests');
    collection.findAndModify(query, 
      [ ['_id','asc'] ], 
      { $set : data }, 
      { safe: true, new: true }, 
      function(err, result) {
         res.redirect('/tests');
      });
  }

}

exports.delete = function(req, res) {

  var id = req.params.id;

  console.log(id);
  
  var collection = new mongodb.Collection(DbManager.getDb(), 'tests');

  var query = { _id: new mongodb.ObjectID(id) };
  collection.remove(query, function(err, result) {

     res.redirect('/tests');
  });

}

