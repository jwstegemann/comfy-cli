import { Image } from 'image-js';
import axios from 'axios';
import * as WebSoccket from 'ws';
import * as fs from 'fs';

export function readFileIntoString(filePath: string): string {
    try {
        const data: string = fs.readFileSync(filePath, 'utf8');
        return data;
    } catch (err) {
        console.error("Error reading the file:", err);
        return '';
    }
}

export function readImageIntoBuffer(imagePath: string): Buffer | null {
    try {
        const buffer: Buffer = fs.readFileSync(imagePath);
        return buffer;
    } catch (err) {
        console.error("Error reading the image:", err);
        return null;
    }
}

export class ComfyConnector {

    constructor(server_address: string, ws_address: string, client_id: string) {
        this.server_address = server_address;
        this.client_id = client_id;
        this.ws_address = ws_address;  
    }

    private server_address: string = "";
    private client_id: string = "";
    private ws_address: string = "";

    private ws: WebSoccket //= new WebSoccket(this.ws_address);

    async getHistory(prompt_id: string) {
        const response = await axios.get(`${this.server_address}/history/${prompt_id}`);
        return await response.data;
    }

    async getImage(filename: string, subfolder: string, folderType: string) {
        const params = new URLSearchParams({
            filename: filename,
            subfolder: subfolder,
            type: folderType
        });

        const response = await axios.get(`${this.server_address}/view?${params}`);
        return response.data;
    }

    async queuePrompt(prompt: string) {
        const data = {
            prompt: prompt,
            client_id: this.client_id
        };

        const response = await axios.post(`${this.server_address}/prompt`, data, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    }

    async generateImages(payload: string) {
        try {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                console.log("WebSocket is not connected. Reconnecting...");
                this.ws = new WebSoccket(this.ws_address);
            }
            const prompt_id = (await this.queuePrompt(payload)).prompt_id;

            while (true) {
                const out = await new Promise<any>((resolve) => this.ws.once('message', resolve));

                if (typeof out === 'string') {
                    const message = JSON.parse(out);

                    if (message.type === 'executing') {
                        const data = message.data;
                        if (data.node === null && data.prompt_id === prompt_id) {
                            break;
                        }
                    }
                }
            }

            const address = ComfyConnector.findOutputNode(payload);
            const history = (await this.getHistory(prompt_id))[prompt_id];
            const filenames = eval(`history['outputs']${address}`)['images'];

            const images: Image[] = [];

            for (const img_info of filenames) {
                const imageData = await this.getImage(img_info.filename, img_info.subfolder, img_info.type);
                const image = await Image.load(imageData);
                images.push(image);
            }

            return images;

        } catch (e) {
            console.error(`generateImages - Unhandled error at line ${e.lineNumber}: ${e.message}`);
        }
    }

    async uploadImage(imageBuffer: Buffer, subfolder?: string | null, folderType?: string | null, overwrite: boolean = false): Promise<any> {
        try { 
            const url = `${this.server_address}/upload/image`;
            const data: Record<string, string> = {
                'overwrite': overwrite.toString()
            };
            if (subfolder) {
                data['subfolder'] = subfolder;
            }
            if (folderType) {
                data['type'] = folderType;
            }
    
            // Convert buffer to a Blob for sending as a file in the fetch API
            const blob = new Blob([imageBuffer], { type: 'image/jpeg' });  // Assuming JPEG, adjust if necessary
            const formData = new FormData();
            formData.append('image', blob, 'uploaded_image.jpg');  // Assuming a default name, adjust if necessary
            for (const key in data) {
                formData.append(key, data[key]);
            }
    
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });
            
            return await response.json();
        } catch (e) {
            // Handle the error similarly as before
            console.error('uploadImage - Unhandled error', e);
            throw e;
        }
    }
    

    static findOutputNode(json_object: any): string | null {
        for (const [key, value] of Object.entries(json_object)) {
            if (typeof value === 'object' && value !== null && 'class_type' in value) {
                if (value["class_type"] === "SaveImage") {
                    return `['${key}']`;
                }

                const result = ComfyConnector.findOutputNode(value);
                if (result) return result;
            }
        }
        return null;
    }

    static replaceKeyValue(json_object: any, target_key: string, new_value: any, class_type_list?: string[], exclude: boolean = true) {
        for (const [key, value] of Object.entries(json_object)) {
            if (typeof value === 'object' && value !== null && 'class_type' in value) {
                const v = value as {[k: string]: any}
                const class_type = (v['class_type'])

                const should_apply_logic = (
                    (exclude && (!class_type_list || !class_type_list.includes(class_type))) ||
                    (!exclude && (class_type_list && class_type_list.includes(class_type)))
                );

                if (should_apply_logic && value.hasOwnProperty(target_key)) {
                    v[target_key] = new_value;
                }

                ComfyConnector.replaceKeyValue(value, target_key, new_value, class_type_list, exclude);
            }

            if (Array.isArray(value)) {
                for (const item of value) {
                    if (typeof item === 'object' && item !== null) {
                        ComfyConnector.replaceKeyValue(item, target_key, new_value, class_type_list, exclude);
                    }
                }
            }
        }
    }
}
