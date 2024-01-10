const { web } = require("webpack");
const webpackConfigFile = require("./webpack.config.js");
const path = require("path");

let webpackAddonConfig = {
    entry: ["./dev/sw/sensorcentral-sw.js"],
    resolve: {
        extensions: [".js"],
    },
    output: {
        filename: "sw.js",
        path: path.resolve(__dirname, "public"),
    },
}
let webpackConfig;

module.exports = function (grunt) {
    const firsttask = grunt.cli.tasks[0];
    if (firsttask === "clientside") {
        webpackConfig = Object.assign({}, webpackConfigFile, {optimization: {minimize: false}});
        webpackAddonConfig = Object.assign(webpackAddonConfig, { mode: "development" });
    } else {
        webpackConfig = Object.assign({}, webpackConfigFile);
        webpackAddonConfig = Object.assign(webpackAddonConfig, { mode: "production" });
    }
    console.log(`Set mode to <${webpackAddonConfig.mode}>`);

    grunt.initConfig({
        clean: {
            all: ["public", "server-dist", "tscommand-*.tmp.txt"],
            public: ["public"],
            serverside: ["server-dist/src"]
        },
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
                        src: "dev/sw/sensorcentral-sw.js",
                        dest: "public/sw.js",
                    },
                    {
                        expand: true,
                        cwd: "src",
                        src: "**/*.js",
                        dest: "server-dist",
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

                    // fonts
                    {
                        expand: true,
                        cwd: "node_modules/font-awesome/fonts",
                        src: "**",
                        dest: "public/fonts",
                    },
                ],
            },
            serverside: {
                files: [
                    {
                        expand: true,
                        cwd: "server-dist/src",
                        src: "**/*.js",
                        dest: "server-dist",
                    },
                ],
            },
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
        webpack: [
            webpackConfig,
            webpackAddonConfig,
        ],
        ts: {
            serverside: {
                tsconfig: "./src/tsconfig.json",
            },
        },
        watch: {
            scripts: {
                files: ["dev/js/*.js", "dev/ts/*.ts", "dev/css/*.css", "dev/sw/*.js", "dev/*.html"],
            },
        },
    });

    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-webpack");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-ts");

    grunt.registerTask("default", [
        "clean:all",
        "ts:serverside",
        "copy:main",
        "webpack",
        "concat",
        "copy:serverside",
        "clean:serverside",
    ]);
    grunt.registerTask("clientside", [
        "clean:public",
        "copy:main",
        "webpack",
        "concat",
    ]);
};
