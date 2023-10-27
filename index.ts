import fetch from "node-fetch";
import * as FormData from 'form-data';
import * as process from "process";

import { ComfyConnector, readFileIntoString, readImageIntoBuffer} from "./ComfyConnector";  // Adjust the path accordingly

// Instantiate the ComfyConnector
const comfy = new ComfyConnector(process.argv[4], process.argv[4], "1726");

async function main() {
    const address = process.argv[4];
    const command = process.argv[2];

    console.log("using: ", address);

    switch (command) {
        case "history":
            const responseHist = await comfy.getHistory("12");
            console.log("History Response:", responseHist);
            break;
        case "upload":
            // Assuming third argument is a path to an image file
            const imagePath = process.argv[3];
            const imageBuffer = readImageIntoBuffer(imagePath);  // We're using Deno for simplicity, but you can use Node's fs/promises
            const responseUpload = await comfy.uploadImage(imageBuffer);
            console.log("Upload Response:", responseUpload);
            break;
        case "generate":
            // Assuming third argument is a path to a JSON prompt file
            const promptPath = process.argv[3];
            const payload = JSON.parse(await readFileIntoString(promptPath));
            const images = await comfy.generateImages(payload);
            images[0].save("out.png");
            console.log("Generated Images:", images.length);
            break;
        default:
            console.log("Unknown command. Supported commands are: upload, generate");
            break;
    }
}

main().catch((error) => {
    console.error("Error:", error);
});