import fetch from "node-fetch";
import * as FormData from 'form-data';
import * as process from "process";

import { ComfyConnector, readFileIntoString, readImageIntoBuffer} from "./ComfyConnector";  // Adjust the path accordingly


async function main() {
    const url = process.argv[2];
    const command = process.argv[3];
    
    // Instantiate the ComfyConnector
    const comfy = new ComfyConnector(url);
    
    console.log("using: ", url);

    switch (command) {
        case "history":
            const responseHist = await comfy.getHistory(process.argv[4]);
            console.log("History Response:", responseHist);
            break;
        case "upload":
            // Assuming third argument is a path to an image file
            const imagePath = process.argv[4];
            const imageBuffer = readImageIntoBuffer(imagePath);  // We're using Deno for simplicity, but you can use Node's fs/promises
            const responseUpload = await comfy.uploadImage(imageBuffer, process.argv[5]);
            console.log("Upload Response:", responseUpload);
            break;
        case "generate":
            // Assuming third argument is a path to a JSON prompt file
            const promptPath = process.argv[4];
            const payload = await readFileIntoString(promptPath);
            const images = await comfy.generateImages(payload);
            const output_filename = process.argv[5];
            images[0].save(output_filename);
            console.log("Saved output as:", output_filename);
            break;
        default:
            console.log("Parameter: <url> generate <workflow> <output-file (PNG)>")
            console.log("           <url> upload <image-file> <filename-on-server>")
            console.log("           <url> history <prompt-id>")
            break;
    }
}

main().catch((error) => {
    console.error("Error:", error);
});