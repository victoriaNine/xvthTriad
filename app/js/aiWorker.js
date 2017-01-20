importScripts("./libs/requirejs/require.js");

require({ baseUrl: "./" }, ["libs/lodash/dist/lodash"], function AIWorker (_) {
        onmessage = function (e) {
            console.log("Message received from main script", e);
            var workerResult = "Result: " + (e.data.data[0] * e.data.data[1]);
            console.log("Posting message back to main script");
            postMessage(workerResult);
        };
    }
);
