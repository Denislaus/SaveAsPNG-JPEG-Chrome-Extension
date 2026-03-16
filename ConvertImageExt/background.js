// Create the context menus when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
    // Parent menu item
    chrome.contextMenus.create({
        id: "save-image-parent",
        title: "Save Image As...",
        contexts: ["image"]
    });

    // Child: Save as PNG
    chrome.contextMenus.create({
        id: "save-as-png",
        parentId: "save-image-parent",
        title: "Save as PNG",
        contexts: ["image"]
    });

    // Child: Save as JPG
    chrome.contextMenus.create({
        id: "save-as-jpg",
        parentId: "save-image-parent",
        title: "Save as JPG",
        contexts: ["image"]
    });
});

// Helper function to extract and format the filename from a URL
function getFilenameFromUrl(url, newExtension) {
    try {
        // Parse the URL to naturally separate the path from query parameters
        const urlObj = new URL(url);
        let pathname = urlObj.pathname;

        // Grab everything after the final '/'
        let filename = pathname.substring(pathname.lastIndexOf('/') + 1);

        // Fallback if the URL doesn't end in a standard file path
        if (!filename) {
            filename = "saved_image";
        } else {
            // Find the last dot to remove the original extension (e.g. .webp)
            const lastDotIndex = filename.lastIndexOf('.');
            if (lastDotIndex !== -1) {
                filename = filename.substring(0, lastDotIndex);
            }

            // Clean up the URL encoding (turns "%20" back into spaces, etc.)
            filename = decodeURIComponent(filename);
        }

        // Combine the cleaned name with the new extension
        return `${filename}.${newExtension}`;
    } catch (error) {
        // Ultimate fallback if URL parsing fails completely
        return `saved_image.${newExtension}`;
    }
}

// Listen for clicks on the context menu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "save-as-png" || info.menuItemId === "save-as-jpg") {
        const isPng = info.menuItemId === "save-as-png";
        const mimeType = isPng ? "image/png" : "image/jpeg";
        const extension = isPng ? "png" : "jpg";

        try {
            // 1. Fetch the image from the clicked URL
            const response = await fetch(info.srcUrl);
            const blob = await response.blob();

            // 2. Create an ImageBitmap from the blob
            const bitmap = await createImageBitmap(blob);

            // 3. Draw the image to an OffscreenCanvas
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const ctx = canvas.getContext('2d');

            // If saving as JPG, fill with a white background first to handle transparency gracefully
            if (!isPng) {
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.drawImage(bitmap, 0, 0);

            // 4. Convert the canvas back to a Blob in the desired format
            const newBlob = await canvas.convertToBlob({ type: mimeType, quality: 1.0 });

            // 5. Generate the new filename
            const finalFilename = getFilenameFromUrl(info.srcUrl, extension);

            // 6. Convert Blob to Base64 Data URL so Chrome can download it
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result;

                // 7. Trigger the download with the new dynamic filename
                chrome.downloads.download({
                    url: dataUrl,
                    filename: finalFilename,
                    saveAs: true // Prompts the user to choose where to save it
                });
            };
            reader.readAsDataURL(newBlob);

        } catch (error) {
            console.error("Failed to fetch or convert image: ", error);
        }
    }
});