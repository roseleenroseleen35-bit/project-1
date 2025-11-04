// Import necessary modules
import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import cors from 'cors';

// Load environment variables from .env file 
dotenv.config();

// --- Configuration ---
const app = express();
const port = process.env.PORT || 3001; 
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${geminiApiKey}`;

// Check if API key is set
if (!geminiApiKey) {
    console.error('Error: GEMINI_API_KEY is not set in the .env file.');
    process.exit(1); // Exit the process with an error code
}

// --- Middleware ---

app.use(cors());

// Use multer for handling file uploads. We'll store files in memory.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- API Routes ---

/**
 * @route POST /api/hug
 * @description Receives two images, calls the Gemini API to merge them,
 * and returns the resulting image.
 */
app.post('/api/hug', upload.fields([{ name: 'image1' }, { name: 'image2' }]), async (req, res) => {
    
    try {
        // 1. Check if files were uploaded
        if (!req.files || !req.files.image1 || !req.files.image2) {
            return res.status(400).json({ error: 'Please upload two images.' });
        }

        // 2. Get file data from multer
        const file1 = req.files.image1[0];
        const file2 = req.files.image2[0];

        // 3. Convert image buffers to Base64 generative parts
        const imageParts = [
            {
                inlineData: {
                    mimeType: file1.mimetype,
                    data: file1.buffer.toString('base64')
                }
            },
            {
                inlineData: {
                    mimeType: file2.mimetype,
                    data: file2.buffer.toString('base64')
                }
            }
        ];

        // 4. Create the prompt and payload for Gemini
        const userPrompt = "Make these two people hug. Create a photorealistic, loving image of these two subjects embracing in a new, single image. Do not just return one of the inputs.";

        const payload = {
            contents: [{
                parts: [
                    { text: userPrompt },
                    imageParts[0], // First image
                    imageParts[1]  // Second image
                ]
            }],
            generationConfig: {
                responseModalities: ['IMAGE'] // We only want an image back
            },
        };

        // 5. Call the Gemini API
        console.log('Calling Gemini API...');
        const apiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            console.error('Gemini API Error:', errorData);
            throw new Error(errorData.error?.message || `Gemini API request failed with status ${apiResponse.status}`);
        }

        const result = await apiResponse.json();

        // 6. Parse the response and find the image data
        const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

        if (!base64Data) {
            let errorMessage = 'The model did not return an image. Please try again.';
            if (result.candidates && result.candidates[0].finishReason === 'SAFETY') {
                errorMessage = 'Image generation blocked due to safety settings.';
            }
            console.error('Image data not found in response:', result);
            throw new Error(errorMessage);
        }

        // 7. Send the successful response back to the frontend
        const imageUrl = `data:image/png;base64,${base64Data}`;
        res.json({ imageUrl: imageUrl });

    } catch (err) {
        console.error('Hug generation failed:', err.message);
        res.status(500).json({ error: err.message || 'An unknown server error occurred.' });
    }
});

// --- Server Start ---
app.listen(port, () => {
    console.log(`HugMaker backend server listening on http://localhost:${port}`); // Updated log
});

