"use strict"

const { workerData, parentPort } = require("worker_threads")

const fluid = require("./fluid")

const { image, extFormats, options } = workerData

generateBuffers(image, extFormats, options)

async function generateBuffers(arr, extFormats, options) {
    try {
        const image = Buffer.from(arr)
        const original = await fluid({ image, options, original: true })
        const { base64, buffers, format } = original
        const formats = [
            { format, buffers },
            { format: "base64", url: base64 },
        ]

        // Base64 already generated, so skip re-generation.
        options.base64 = false

        // Generate buffers for each passed formats other than the original.
        const promises = extFormats.map(format => {
            // Overwrite the initial format.
            options.toFormat = format

            return fluid({ image, options, original: false }).catch(
                sendErrToParent
            )
        })

        const extraFormats = await Promise.all(promises)

        extraFormats.forEach(({ buffers, format }) => {
            formats.push({ format, buffers })
        })

        parentPort.postMessage(formats)
    } catch (error) {
        sendErrToParent(error)
    }
}

function sendErrToParent(error) {
    parentPort.postMessage({ error })
}
