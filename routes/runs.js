var db         = require('../db');
var mongodb    = require('mongodb');
var util       = require('./util');
var async      = require('async');
var moment     = require('moment');
var _          = require('underscore');

exports.list = function(req, res) {

  var term = req.urlparams.term;

  async.parallel({
    tests: function(callback) {

      var query = {};

      if (term) {
        query = { 
          name : { $regex :  term, $options: '-i'}
        };
      }

      var collection = new mongodb.Collection(DbManager.getDb(), 'runs');
      collection.find(query, { sort: { group: 1 } }).toArray(function(err, results) {
        if (err) return callback(err, 0);
        callback(null, results);
      });

    },
    total: function(callback) {

      var collection = new mongodb.Collection(DbManager.getDb(), 'runs');
      collection.find({}).count(function(err, results) {
        if (err) return callback(err, 0);
        callback(null, results);
      });

    },
    completed: function(callback) {

      var collection = new mongodb.Collection(DbManager.getDb(), 'runs');
      collection.find({ status: { $ne: 'Pending' }}).count(function(err, results) {
        if (err) return callback(err, 0);
        callback(null, results);
      });

    }
  }, function(err, results) {

    var data = {
      total:   results.total,
      pending: results.completed,
      complete: Math.round(100 * (results.completed / results.total))
    };

    res.render('runs', { tests: results.tests, term: term || '', stats: data });

  });

}

exports.add = function(req, res) {

  var data = {
    name:  '',
    notes: '',
    sha:   ''
  };

  res.render('runs_edit', { data: data, count: -1, id: null });
}

exports.edit = function(req, res) {
  
  var id = req.params.id;

  async.parallel({
    count: function(callback) {


      var query = { $or: [ 
        { runID: new mongodb.ObjectID(id) },
        { runID: id },
        ]
      };
      var collection = new mongodb.Collection(DbManager.getDb(), 'tests');

      collection.find(query).count(function(err, result) {
        if (err) return;
        callback(null, result);
  
      });

    },
    data: function(callback) {

      var query = { _id: new mongodb.ObjectID(id) };

      var collection = new mongodb.Collection(DbManager.getDb(), 'runs');
      collection.findOne(query, function(err, result) {
        if (err) return;
        callback(null, result);
        
      });

    }
  }, function(err, results) {

    res.render('runs_edit', { data: results.data, count: results.count, id: id });

  });

}

exports.update = function(req, res) {

  var id = req.body.id;
  var mdate;

  var date = req.body.date;
  if (!date) {
    mdate = moment();
  } else {
    mdate = moment(date);
  }

  var data = {
    name:      req.body.name || 'No Name',
    notes:     req.body.notes,
    sha:       req.body.sha,
    date:      mdate.unix() * 1000,
    total_bugs_in_production: req.body.total_bugs_in_production || 0,
    total_code_coverage: req.body.total_code_coverage,
    total_tests: req.body.total_tests
  };

  if (!id) {
    data.createdby = req.session.user.github.login;
    data.created = moment().unix() * 1000;
  } else {
    data.modifiedby = req.session.user.github.login;
    data.modified = moment().unix() * 1000;
  }

  var collection = new mongodb.Collection(DbManager.getDb(), 'runs');

  if (!id) {
    collection.insert(data, { safe: true }, function(err, result) {

      var newRun = result[0];
      var runID =  newRun._id;

      var query = {
         runID: { $exists : false }
      };

      var testCollection = new mongodb.Collection(DbManager.getDb(), 'tests');
      testCollection.find(query).toArray(function(err, results) {
        
        var masterTests = results;
        _.each(masterTests, function(o) {
          o.status = 'Pending';
          o.name = o.name + ' [Copy]';
          o.claimedby = '';
          o.isMaster = false;
          o.parentID = o._id;
          o.runID = runID;

          delete o._id;
        });

        testCollection.insert(masterTests, { safe: true }, function(err, result) {
          console.log('Inserted a Ton of Tests', results.length);
        });

      });

      res.redirect('/runs');
    });
  } else {
    collection.findAndModify({ _id: new mongodb.ObjectID( id ) }, 
      [ ['_id','asc'] ], 
      { $set : data }, 
      { safe: true, new: true }, 
      function(err, result) {
         res.redirect('/runs');
      });
  }

}

exports.delete = function(req, res) {

  var id = req.params.id;

  var collection = new mongodb.Collection(DbManager.getDb(), 'runs');
  var query = { _id: new mongodb.ObjectID(id) };
  collection.remove(query, function(err, result) {

     var query = { 
      $or: [ { runID: new mongodb.ObjectID( id ) }, { runID: id } ]
     };

     var testCollection = new mongodb.Collection(DbManager.getDb(), 'tests');
     testCollection.remove(query, { safe: true }, function(err, results) {});

     res.redirect('/runs');
  });

}

exports.listTests =  function(req, res) {

  var runID = req.params.id;
  var term = req.urlparams.term;

  async.parallel({
    tests: function(callback) {

      var query = { $or: 
        [
          { runID: new mongodb.ObjectID( runID ) },
          { runID: runID }
        ]
      };

      if (term) {
        query.name = { $regex :  term, $options: '-i'};
      }

      var collection = new mongodb.Collection(DbManager.getDb(), 'tests');
      collection.find(query, { sort: { group: 1 } }).toArray(function(err, results) {
        if (err) return callback(err, 0);
        callback(null, results);
      });

    },
    run: function(callback) {

      var collection = new mongodb.Collection(DbManager.getDb(), 'runs');
      collection.findOne({ _id: new mongodb.ObjectID(runID) } , function(err, results) {
        if (err) return callback(err, 0);
        callback(null, results);
      });

    },
    total: function(callback) {

      var query = { 
        $or: [ { runID: new mongodb.ObjectID( runID ) }, { runID: runID } ]
      };

      var collection = new mongodb.Collection(DbManager.getDb(), 'tests');
      collection.find(query).count(function(err, results) {
        if (err) return callback(err, 0);
        callback(null, results);
      });

    },
    completed: function(callback) {

      var query = { 
        $or: [ { runID: new mongodb.ObjectID( runID ) }, { runID: runID } ],
        status: { $ne: 'Pending' }
      };

      var collection = new mongodb.Collection(DbManager.getDb(), 'tests');
      collection.find(query).count(function(err, results) {
        if (err) return callback(err, 0);
        callback(null, results);
      });

    }
  }, function(err, results) {

    var data = {
      total:   results.total,
      pending: results.completed,
      complete: Math.round(100 * (results.completed / results.total))
    };

    console.log(results.run);

    res.render('run_tests', { run: results.run, tests: results.tests, term: term || '', stats: data });

  });

}

exports.processTest = function(req, res) {

  var id = req.params.id;
  var query = { _id: new mongodb.ObjectID( id ) };

  var collection = new mongodb.Collection(DbManager.getDb(), 'tests');
  collection.findOne(query, function(err, result) {
    if (err) return;

    res.render('release_test', { data: result, id: id });
  });

}

exports.processTestUpdate = function(req, res) {

  var id = req.body.id;

  var data = {
    status:    req.body.status,
    claimedby: req.body.claimedby
  };

  var collection = new mongodb.Collection(DbManager.getDb(), 'tests');

  collection.findAndModify({ _id: new mongodb.ObjectID( id ) }, 
    [ ['_id','asc'] ], 
    { $set : data }, 
    { safe: true, new: true }, 
    function(err, result) {
       res.redirect('/runs/' + req.body.runID + '/tests');
    });

}