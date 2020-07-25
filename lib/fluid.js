"use strict"

// Below codes derived from "https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby-plugin-sharp/src/index.js"

const nodeObjectHash = require("node-object-hash")

const sharp = require("sharp")

const imageSize = require("probe-image-size")

const transform = require("./transform")

module.exports = async function fluid({
    image: file,
    options,
    originalName,
    original,
}) {
    const metadata = await sharp(file).metadata()
    let { width, height, format } = metadata

    options.toFormat = options.toFormat || (format === "jpeg" ? "jpg" : format)

    const fixedDimension =
        options.maxWidth === undefined ? "maxHeight" : "maxWidth"
    const fluidSizes = [options[fixedDimension]]
    fluidSizes.push(options[fixedDimension] / 4)
    fluidSizes.push(options[fixedDimension] / 2)
    fluidSizes.push(options[fixedDimension] * 1.5)
    fluidSizes.push(options[fixedDimension] * 2)

    // Filter sizes where size less than original.
    let filteredSizes = fluidSizes.filter(
        size => size < (fixedDimension === "maxWidth" ? width : height)
    )

    // Add the original image to ensure the largest image possible
    // is available for small images. Also so we can link to
    // the original image.
    // Original image already compressed, so do not re-compress again.
    !original &&
        filteredSizes.push(fixedDimension === "maxWidth" ? width : height)
    filteredSizes = filteredSizes.sort((a, b) => a - b)

    // Queue sizes for processing.
    const dimensionAttr = fixedDimension === "maxWidth" ? "width" : "height"
    const otherDimensionAttr =
        fixedDimension === "maxWidth" ? "height" : "width"

    // Deriver different size settings from options.
    const transforms = filteredSizes.map(size => {
        const arrrgs = { ...options }
        if (arrrgs[otherDimensionAttr]) {
            arrrgs[otherDimensionAttr] = undefined
        }

        arrrgs[dimensionAttr] = Math.round(size)

        if (options.maxWidth !== undefined && options.maxHeight !== undefined) {
            arrrgs.height = Math.round(
                size * (options.maxHeight / options.maxWidth)
            )
        }

        return arrrgs
    })

    const images = batchQueueImageResizing({
        buffer: file,
        transforms,
    })

    let base64Image

    if (options.base64) {
        const base64Width = options.base64Width
        const base64Height = Math.max(
            1,
            Math.round(
                base64Width /
                    // Images list will be empty,
                    // If the original image's dimensions are
                    // less than the alternative dimensions.
                    // So we create manually the aspect radio
                    // from the original image's dimensions.
                    (
                        images[0] || {
                            aspectRatio: calculateAspectRadio(width, height),
                        }
                    ).aspectRatio
            )
        )
        const base64Args = {
            ...options,
            width: base64Width,
            height: base64Height,
        }

        // Get base64 version
        base64Image = await generateBase64({
            options: base64Args,
            file,
            originalName,
        })
    }

    // Create images
    const buffers = await Promise.all(
        transform(sharp(file), images, {
            useMozJpeg: options.useMozJpeg,
            stripMetadata: options.stripMetadata,
        })
    )

    const entry = images.reduce(
        (result, current) => {
            const base = options[fixedDimension]
            const resultDim = Math.abs(base - result[dimensionAttr])
            const currentDim = Math.abs(base - current[dimensionAttr])
            return resultDim < currentDim ? result : current
        },
        { [dimensionAttr]: 0 }
    ).src

    if (options.toFormat) {
        switch (options.toFormat) {
            case "jpg":
                format = "jpeg"
                break
            default:
                format = options.toFormat
                break
        }
    }
    const mime = `image/${format}`

    buffers.forEach(buffer => {
        buffer.info.ext = `.${format}`
        buffer.info.format = format
        buffer.info.isEntry = buffer.info.name === entry
        buffer.info.mime = mime
        buffer.info.size = bytesToKbytes(buffer.info.size)
    })

    return {
        base64: base64Image && base64Image.src,
        buffers,
        format,
    }
}

function batchQueueImageResizing({ buffer, transforms = [] }) {
    // loop through all transforms to set correct variables
    return transforms.map(transform => {
        const { src, width, height, aspectRatio, options } = prepareQueue({
            buffer,
            transform,
        })

        return { src, width, height, aspectRatio, options }
    })
}

function prepareQueue({ buffer, transform }) {
    const src = createDigest(transform)
    const {
        width,
        height,
        aspectRatio,
    } = calculateImageDimensionsAndAspectRatio(buffer, transform)

    return {
        src,
        width,
        height,
        aspectRatio,
        options: {
            ...transform,
            defaultQuality: 50,
            forceBase64Format: false,
            lazyImageGeneration: true,
            stripMetadata: true,
            useMozJpeg: false,
            sizeByPixelDensity: false,
        },
    }
}

function createDigest(transform) {
    const digest = nodeObjectHash(hashOptions).hash(transform)

    return digest.substr(digest.length - 5)
}

const hashOptions = {
    coerce: false,
    alg: "md5",
    enc: "hex",
    sort: {
        map: true,
        object: true,
        array: false,
        set: false,
    },
}

function calculateImageDimensionsAndAspectRatio(buf, transform) {
    // Calculate the eventual width/height of the image.
    const dimensions = getImageSize(buf)
    const imageAspectRatio = dimensions.width / dimensions.height
    let width = transform.width
    let height = transform.height

    if (transform.width && !transform.height) {
        width = transform.width
        height = Math.round(transform.width / imageAspectRatio)
    }

    if (transform.height && !transform.width) {
        width = Math.round(transform.height * imageAspectRatio)
        height = transform.height
    }

    return { width, height, aspectRatio: calculateAspectRadio(width, height) }
}

function getImageSize(buf) {
    // const dimensions = imageSize.sync(toArray(buf));
    const dimensions = imageSize.sync(buf)
    return dimensions
}

async function generateBase64({ options, file, originalName }) {
    options.width = 20
    options.jpegQuality = null
    options.pngQuality = null
    options.webpQuality = null
    options.jpegProgressive = true
    options.pathPrefix = ""
    options.sizeByPixelDensity = false
    options.maxWidth = 800

    let pipeline

    try {
        pipeline = sharp(file)

        if (!options.rotate) {
            pipeline.rotate()
        }
    } catch (err) {
        console.error(err)
        return null
    }

    if (options.trim) {
        pipeline = pipeline.trim(options.trim)
    }

    pipeline
        .resize({
            width: options.width,
            height: options.height,
            position: options.cropFocus,
            fit: options.fit,
            background: options.background,
        })
        .png({
            compressionLevel: options.pngCompressionLevel,
            adaptiveFiltering: false,
            force: options.toFormat === "png",
        })
        .jpeg({
            quality: options.jpegQuality || options.quality,
            progressive: options.jpegProgressive,
            force: options.toFormat === "jpg",
        })
        .webp({
            quality: options.webpQuality || options.quality,
            force: options.toFormat === "webp",
        })

    // rotate
    if (options.rotate && options.rotate !== 0) {
        pipeline = pipeline.rotate(options.rotate)
    }

    const { data: buffer, info } = await pipeline.toBuffer({
        resolveWithObject: true,
    })
    const base64output = {
        src: `data:image/${info.format};base64,${buffer.toString("base64")}`,
        width: info.width,
        height: info.height,
        aspectRatio: info.width / info.height,
        originalName,
    }
    return base64output
}

function bytesToKbytes(bytes) {
    return Math.round((bytes / 1000) * 100) / 100
}

function calculateAspectRadio(width, height) {
    return width / height
}
