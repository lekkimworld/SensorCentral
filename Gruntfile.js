module.exports = function(grunt) {
    grunt.initConfig({
        clean: ['public/'],
        copy: {
            main: {
                "files": [
                    {
                        expand: true,
                        cwd: 'dev/images',
                        src: '*.*',
                        dest: 'public/images/'
                    }, 
                    {
                        src: 'dev/manifest.json',
                        dest: 'public/manifest.json'
                    }
                ]
            }
        },
        browserify: {
            'public/js/index.js': ['dev/js/**.js']
        },
        rework: {
            'public/css/styles.css': ['dev/css/**.css'],
            options: {
                vendors: ['-moz-', '-webkit-']
            }
        },
        watch: {
            scripts: {
                files: ['dev/js/*.js', 'dev/css/*.css'],
                tasks: ['default']
              }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-rework');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('default', ['clean', 'copy', 'browserify', 'rework']);
};
