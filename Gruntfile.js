module.exports = function (grunt) {
  grunt.registerTask("lint", "Check required files exist", function () {
    ["index.html", "styles.css", "script.js"].forEach(function (f) {
      if (!grunt.file.exists(f)) grunt.fail.warn("Missing: " + f);
    });
    grunt.log.ok("All required files present.");
  });

  grunt.registerTask("default", ["lint"]);
};
