const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// إعدادات الـ CORS والـ Body Parser لتمرير واستقبال البيانات الكبيرة بدون قيود
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// جلب المفاتيح من بيئة Render
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// صفحة تأكيدية لفحص السيرفر
app.get('/', (req, res) => {
    res.status(200).send('🚀 سيرفر سالم ميديا السحابي الفولاذي يعمل بكفاءة قصوى ومحمي بالكامل!');
});

// 1. ممر التوليد النصي لـ Gemini 2.5 Flash
app.post('/api/generate', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: "مفتاح الـ API الخاص بجوجل غير معرّف." });
        }

        const model = "gemini-2.5-flash-preview-09-2025";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error("[Text Gen Error]:", error);
        res.status(500).json({ error: error.message });
    }
});

// 2. ممر توليد الصور الآمن والذكي عبر FLUX باستخدام fetch القياسي والآمن لـ Render
app.post('/api/generate-image', async (req, res) => {
    try {
        if (!HUGGINGFACE_API_KEY) {
            return res.status(500).json({ error: "مفتاح HUGGINGFACE_API_KEY غير معرّف في بيئة Render." });
        }

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "يرجى كتابة موجه إعلاني للرسم." });
        }

        console.log(`[Proxy] Generating image via FLUX for prompt: "${prompt}"`);

        const MODEL_ID = "black-forest-labs/FLUX.1-schnell";
        const url = `https://api-inference.huggingface.co/models/${MODEL_ID}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: prompt,
                options: {
                    wait_for_model: true // الانتظار الإلزامي لاستيقاظ الموديل
                }
            })
        });

        // إذا كان السيرفر مشغولاً أو هناك خطأ
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("[HuggingFace HTTP Error]:", response.status, errorBody);
            throw new Error(`HuggingFace_HTTP_${response.status}: ${errorBody}`);
        }

        // استقبال البيانات الثنائية للصورة
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');

        res.json({ 
            success: true,
            imageBase64: base64Image,
            imageUrl: `data:image/jpeg;base64,${base64Image}`
        });

    } catch (error) {
        console.error("[HuggingFace Endpoint Error]:", error.message);
        
        let friendlyMessage = error.message;
        if (friendlyMessage.includes("HuggingFace_HTTP_401")) {
            friendlyMessage = "مفتاح HUGGINGFACE_API_KEY غير صالح أو انتهت صلاحيته. يرجى مراجعته في Render.";
        } else if (friendlyMessage.includes("HuggingFace_HTTP_403")) {
            friendlyMessage = "تم رفض الوصول من Hugging Face. تأكد من تفعيل صلاحيات المفتاح.";
        } else if (friendlyMessage.includes("HuggingFace_HTTP_503")) {
            friendlyMessage = "سيرفرات FLUX مزدحمة حالياً ومستغرقة في النوم، يرجى تكرار الضغط بعد 10 ثوانٍ ليستيقظ.";
        }

        res.status(500).json({ error: friendlyMessage });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Sercure Proxy Server is actively running on port ${PORT}`);
});
