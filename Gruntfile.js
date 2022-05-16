module.exports = function(grunt) {
    grunt.initConfig({
        clean: ["public/", "server-dist", "build-temp"],
        copy: {
            main: {
                files: [
                    {
                        src: "dev/images/icon-32.png",
                        dest: "public/favicon.ico",
                    },
                    {
                        expand: true,
                        cwd: "dev/images",
                        src: "*.*",
                        dest: "public/images/",
                    },
                    {
                        src: "dev/manifest.json",
                        dest: "public/manifest.json",
                    },
                    {
                        expand: true,
                        cwd: "src",
                        src: "**/*.js",
                        dest: "server-dist",
                    },
                    {
                        expand: true,
                        cwd: "node_modules/eonasdan-bootstrap-datetimepicker/build/js",
                        src: "**",
                        dest: "public/js",
                    },
                    {
                        expand: true,
                        cwd: "node_modules/moment/min",
                        src: "moment-with-locales.min.js",
                        dest: "public/js",
                    },

                    // client side dependencies
                    {
                        expand: true,
                        cwd: "node_modules/bootstrap/dist/js",
                        src: "bootstrap.bundle.min.js",
                        dest: "public/js",
                    },
                    {
                        expand: true,
                        cwd: "node_modules/jquery/dist",
                        src: "jquery.min.js",
                        dest: "public/js",
                    },

                    // fonts
                    {
                        expand: true,
                        cwd: "node_modules/font-awesome/fonts",
                        src: "**",
                        dest: "public/fonts",
                    },
                ],
            },
        },
        browserify: {
            "public/js/index.js": ["dev/js/*.js"],
            "public/sw.js": ["dev/js/sw/*.js"],
        },
        concat: {
            "public/css/styles.css": [
                "dev/css/**.css",
                "node_modules/font-awesome/css/font-awesome.css",
                "node_modules/bootstrap/dist/css/bootstrap.min.css",
                "node_modules/chart.js/dist/Chart.min.css",
                "node_modules/eonasdan-bootstrap-datetimepicker/build/css/bootstrap-datetimepicker.min.css",
            ],
        },

        ts: {
            default: {
                tsconfig: true,
                src: ["**/*.ts", "!node_modules/**/*.ts"],
                options: {
                    rootDir: "src",
                },
            },
        },
        watch: {
            scripts: {
                files: ["dev/js/*.js", "dev/css/*.css", "dev/sw/*.js", "dev/*.html"],
                tasks: ["browserify"],
            },
        },
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks("grunt-ts");

    grunt.registerTask('default', ['clean', 'copy', 'browserify', "concat", 'ts']);
};
