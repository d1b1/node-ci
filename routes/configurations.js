var db         = require('../db');
var mongodb    = require('mongodb');

exports.list = function(req, res) {
  
  var query = {};
  var collection = new mongodb.Collection(DbManager.getDb(), 'configurations');
  collection.find(query).toArray(function(err, results) {
    if (err) return;

    res.render('configurations', { configurations: results });
  });

}

exports.add = function(req, res) {
  var data = {
    name: '',
    configurations: [],
    notes: ''
  }
  res.render('configuration_edit', { data: data, config_id: null });
}

exports.edit = function(req, res) {
  
  var id = req.params.id;

  var query = { _id: new mongodb.ObjectID(id) };

  var collection = new mongodb.Collection(DbManager.getDb(), 'configurations');
  collection.findOne(query, function(err, result) {
    if (err) return;

    console.log(result);
    if (!result.configurations) result.configurations = [];

    res.render('configuration_edit', { data: result, config_id: id });
  });

}

exports.editUpdate = function(req, res) {

  var config_id = req.body.config_id;

  var config = [];
  for (var i=0; i<20; i++) {
    if (req.body['name_'+i]) {
      config.push({ name: req.body['name_'+i].trim(), value: req.body['value_'+i] || '-' })
    }
  }

  var data = {
    name: req.body.configuration_name || 'No Name',
    configurations: config,
    notes: req.body.configuration_notes || 'No Notes'
  };

  if (!config_id) {

    var collection = new mongodb.Collection(DbManager.getDb(), 'configurations');
    collection.insert(data, { safe: true}, function(err, result) {
      if (err) {
        console.log(err);
      };

      console.log('Insert', result)
    });

    res.redirect('/configurations');
  } else {

    var query = { _id: new mongodb.ObjectID( config_id ) };

    var collection = new mongodb.Collection(DbManager.getDb(), 'configurations');
    collection.findAndModify(query, 
      [ ['_id','asc'] ], 
      { $set : data }, 
      { safe: true, new: true }, 
      function(err, result) {

         res.redirect('/configurations');
      });

  }

}