"use strict"

// Below codes derived from "https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby-plugin-sharp/src/process-file.js"

const sharp = require("sharp")

const imagemin = require("imagemin")

const imageminMozjpeg = require("imagemin-mozjpeg")

const imageminPngquant = require("imagemin-pngquant")

const imageminWebp = require("imagemin-webp")

module.exports = function transform(pipeline, transforms, options) {
    const transformsCount = transforms.length
    return transforms.map(async transform => {
        const { options: transformArgs } = transform
        let clonedPipeline = transformsCount > 1 ? pipeline.clone() : pipeline

        if (transformArgs.trim) {
            clonedPipeline = clonedPipeline.trim(transformArgs.trim)
        }

        if (!transformArgs.rotate) {
            clonedPipeline = clonedPipeline.rotate()
        }

        // Sharp only allows ints as height/width. Since both aren't always
        // set, check first before trying to round them.
        let roundedHeight = transformArgs.height

        if (roundedHeight) {
            roundedHeight = Math.round(roundedHeight)
        }

        let roundedWidth = transformArgs.width

        if (roundedWidth) {
            roundedWidth = Math.round(roundedWidth)
        }

        clonedPipeline
            .resize(roundedWidth, roundedHeight, {
                position: transformArgs.cropFocus,
                fit: transformArgs.fit,
                background: transformArgs.background,
            })
            .png({
                compressionLevel: transformArgs.pngCompressionLevel,
                adaptiveFiltering: false,
                force: transformArgs.toFormat === "png",
            })
            .webp({
                quality: transformArgs.webpQuality || transformArgs.quality,
                force: transformArgs.toFormat === "webp",
            })
            .tiff({
                quality: transformArgs.quality,
                force: transformArgs.toFormat === "tiff",
            })

        // jpeg
        if (!options.useMozJpeg) {
            clonedPipeline = clonedPipeline.jpeg({
                quality: transformArgs.jpegQuality || transformArgs.quality,
                progressive: transformArgs.jpegProgressive,
                force: transformArgs.toFormat === "jpg",
            })
        }

        // rotate
        if (transformArgs.rotate && transformArgs.rotate !== 0) {
            clonedPipeline = clonedPipeline.rotate(transformArgs.rotate)
        }

        // lets decide how we want to save this transform
        if (transformArgs.toFormat === "png")
            return compressPng(clonedPipeline, transform.src, {
                pngQuality: transformArgs.pngQuality,
                quality: transformArgs.quality,
                pngCompressionSpeed: transformArgs.compressionSpeed,
                stripMetadata: options.stripMetadata,
            })

        if (options.useMozJpeg && transformArgs.toFormat === "jpg")
            return compressJpg(clonedPipeline, transform.src, transformArgs)

        if (transformArgs.toFormat === "webp")
            return compressWebP(clonedPipeline, transform.src, transformArgs)

        return toBufferWithMeta(clonedPipeline, transform.src)
    })
}

function compressPng(pipeline, name, options) {
    const optQuality = options.pngQuality || options.quality

    return withSharpBuffer(pipeline, name, sharpBuffer =>
        imagemin.buffer(sharpBuffer, {
            plugins: [
                imageminPngquant({
                    quality: [
                        optQuality / 100,
                        Math.min(optQuality + 25, 100) / 100,
                    ],
                    // e.g. 40-65
                    speed: options.pngCompressionSpeed
                        ? options.pngCompressionSpeed
                        : undefined,
                    strip: !!options.stripMetadata, // Must be a bool
                }),
            ],
        })
    )
}

function compressJpg(pipeline, name, options) {
    return withSharpBuffer(pipeline, name, sharpBuffer =>
        imagemin.buffer(sharpBuffer, {
            plugins: [
                imageminMozjpeg({
                    quality: options.jpegQuality || options.quality,
                    progressive: options.jpegProgressive,
                }),
            ],
        })
    )
}

function compressWebP(pipeline, name, options) {
    return withSharpBuffer(pipeline, name, sharpBuffer =>
        imagemin.buffer(sharpBuffer, {
            plugins: [
                imageminWebp({
                    quality: options.webpQuality || options.quality,
                    metadata: "all",
                }),
            ],
        })
    )
}

function withSharpBuffer(pipeline, name, cb) {
    return withMetaData(pipeline.toBuffer().then(cb), name)
}

function withMetaData(promise, name) {
    return promise.then(buffer => toBufferWithMeta(sharp(buffer), name))
}

function toBufferWithMeta(pipeline, name) {
    return pipeline.toBuffer({ resolveWithObject: true }).then(image => {
        image.info.name = name
        return image
    })
}
