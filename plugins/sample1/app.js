var moment = require('moment');

Plugin1 = (function() {

  var name = "My Special Plugin 1";
  var now = 0;

  console.log('Starting the plugin');

  var preBuild = function() {
    console.log('Sample Plugin 1: Got preBuild request.')
  }

  var postBuild = function() {
    console.log('Sample Plugin 1: Got postBuild request.')
  }

  return {
    start: function(ci) {
       
      var now = moment().unix();
      this.ci = ci;

      ci.on('prebuild',  preBuild );
      ci.on('postbuild', postBuild );

      return this;
    },
    getName: function() {
      return name;
    }
  }
})();

exports.Plugin1 = Plugin1;
