const pathToWorker = require("path").join(__dirname, "worker.js")

const generateWorker = require("./generateWorker")

module.exports = strapiSharp

function strapiSharp({
    image,
    extFormats = ["webp"],
    options = {
        background: "rgba(0,0,0,1)",
        base64: true,
        base64Width: 20,
        cropFocus: 17,
        fit: "cover",
        jpegProgressive: true,
        jpegQuality: null,
        maxWidth: 768,
        pathPrefix: "",
        pngCompressionLevel: 9,
        pngCompressionSpeed: 4,
        pngQuality: null,
        quality: 50,
        rotate: 0,
        sizeByPixelDensity: false,
        stripMetadata: true,
        toFormat: "",
        toFormatBase64: "",
        trim: false,
        useMozJpeg: false,
        webpQuality: null,
        width: 400
    },
}) {
    return generateWorker(pathToWorker, {
        image,
        extFormats,
        options,
    })
}
