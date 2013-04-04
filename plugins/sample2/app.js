
Plugin2 = (function() {

  var name = "My Special Plugin 2";

  console.log('Starting the plugin 2');

  var preBuild = function() {
    console.log('Sample Plugin 12: Got preBuild request.')
  }

  var postBuild = function() {
    console.log('Sample Plugin 2: Got postBuild request.')
  }

  return {
    start: function(ci) {
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

exports.Plugin2 = Plugin2;
