const cloudinary = require("../config/cloudinary");

async function uploadImage(fileBuffer, conversationId) {
  return new Promise((resolve, reject) => {
    const folder = `chat-app/${conversationId}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
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

async function deleteImage(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error(`Failed to delete Cloudinary image ${publicId}:`, err.message);
  }
}

async function deleteMultipleImages(publicIds) {
  if (!publicIds.length) return;

  try {
    await cloudinary.api.delete_resources(publicIds);
  } catch (err) {
    console.error("Failed to delete Cloudinary images:", err.message);
  }
}

module.exports = { uploadImage, deleteImage, deleteMultipleImages };
