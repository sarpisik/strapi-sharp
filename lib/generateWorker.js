const { Worker } = require("worker_threads");

module.exports = function generateWorker(workerPath, workerData) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerPath, { workerData });
        worker.on("message", (message) => {
            if ("error" in message) {
                console.log("Received handled error from worker.");
                reject(message.error);
            } else {
                resolve(message);
            }
        });
        worker.on("error", reject);
        worker.on("exit", (code) => {
            if (code !== 0)
                reject(new Error(`Worker stopped with exit code ${code}`));

            console.log(`Worker stopped successfully with exit code ${code}`);
        });
    });
};
