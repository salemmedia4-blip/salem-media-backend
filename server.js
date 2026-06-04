app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;
        
        // مسار Imagen 3.0 (predict endpoint)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;
        
        // نرسل الطلب لجوجل بصيغة بيانات الصور وليس كشات
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [{ prompt: prompt }],
                parameters: { sampleCount: 1 }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message });
        }

        // جوجل ترجع الصورة في هذا المسار الدقيق (bytesBase64Encoded)
        const base64Image = data.predictions[0].bytesBase64Encoded;
        res.json({ imageBase64: base64Image });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
