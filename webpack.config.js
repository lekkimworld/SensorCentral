const path = require("path");

module.exports = {
    devtool: "source-map",
    entry: ["./dev/ts/sensorcentral-index.ts"],
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: "ts-loader",
                include: [path.resolve(__dirname, "dev", "ts")],
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "public", "js"),
    },
};