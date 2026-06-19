const cloudinary = require("../config/cloudinary");

const VIDEO_CHUNK_SIZE = 6 * 1024 * 1024; // 6 MB

async function uploadMedia(fileBuffer, conversationId, resourceType = "image") {
  return new Promise((resolve, reject) => {
    const options = {
      folder: `chat-app/${conversationId}`,
      resource_type: resourceType,
      transformation: [{ quality: "auto" }],
    };

    // Chunked stream for video/audio — more resilient for large files
    const uploadFn = resourceType === "video"
      ? cloudinary.uploader.upload_chunked_stream.bind(cloudinary.uploader)
      : cloudinary.uploader.upload_stream.bind(cloudinary.uploader);

    const stream = uploadFn(
      resourceType === "video" ? { ...options, chunk_size: VIDEO_CHUNK_SIZE } : options,
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          duration: result.duration ?? null,
        });
      }
    );
    stream.end(fileBuffer);
  });
}

// Backwards-compat wrapper
async function uploadImage(fileBuffer, conversationId) {
  const { url, publicId } = await uploadMedia(fileBuffer, conversationId, "image");
  return { url, publicId };
}

async function deleteMedia(publicId, resourceType = "image") {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error(`Failed to delete Cloudinary ${resourceType} ${publicId}:`, err.message);
  }
}

// Backwards-compat wrapper
async function deleteImage(publicId) {
  return deleteMedia(publicId, "image");
}

// items: [{ publicId, resourceType }]
// Groups by resourceType because Cloudinary delete_resources is per resource_type.
async function deleteMultipleMedia(items) {
  if (!items.length) return;

  const byType = {};
  for (const { publicId, resourceType = "image" } of items) {
    (byType[resourceType] ??= []).push(publicId);
  }

  for (const [resourceType, publicIds] of Object.entries(byType)) {
    try {
      await cloudinary.api.delete_resources(publicIds, { resource_type: resourceType });
    } catch (err) {
      console.error(`Cloudinary bulk delete (${resourceType}) failed:`, err.message);
    }
  }
}

// Backwards-compat wrapper (image-only)
async function deleteMultipleImages(publicIds) {
  return deleteMultipleMedia(publicIds.map((id) => ({ publicId: id, resourceType: "image" })));
}

async function uploadBackground(fileBuffer, conversationId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: `chat-app/conversation-backgrounds/${conversationId}`,
        resource_type: "image",
        overwrite: true,
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
    uploadStream.end(fileBuffer);
  });
}

module.exports = {
  uploadMedia,
  uploadImage,
  deleteMedia,
  deleteImage,
  deleteMultipleMedia,
  deleteMultipleImages,
  uploadBackground,
};
