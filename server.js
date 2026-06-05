const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// إعدادات الـ CORS والـ Body Parser لتمرير واستقبال البيانات الكبيرة
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
    res.status(200).send('🚀 سيرفر سالم ميديا السحابي المطور يعمل بكفاءة! مرتبط الآن بـ Gemini (للنصوص) و Hugging Face FLUX (للصور المجانية)!');
});

// 1. ممر التوليد النصي (يبقى على Gemini 2.5 Flash للأدوات التسويقية)
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

// 2. ممر توليد الصور الفوري (تم تحويله بالكامل إلى Hugging Face Inference API المجاني)
app.post('/api/generate-image', async (req, res) => {
    try {
        if (!HUGGINGFACE_API_KEY) {
            return res.status(500).json({ error: "مفتاح HUGGINGFACE_API_KEY غير معرّف في بيئة Render." });
        }

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "يرجى كتابة موجه إعلاني للرسم." });
        }

        // استخدام موديل FLUX.1-schnell من Hugging Face (مجاني، سريع، ومفتوح)
        const MODEL_ID = "black-forest-labs/FLUX.1-schnell";
        const url = `https://api-inference.huggingface.co/models/${MODEL_ID}`;

        // إرسال الطلب مع أمر الانتظار الإلزامي لمنع حدوث "fetch failed"
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json',
                'User-Agent': 'SalemMediaApp/1.0' // لإعلام Hugging Face بأنه اتصال من تطبيق رسمي
            },
            body: JSON.stringify({
                inputs: prompt,
                options: {
                    wait_for_model: true // ⚡ الأمر السحري: انتظر استيقاظ الموديل ولا تقطع الاتصال فوراً!
                }
            })
        });

        // معالجة الأخطاء من Hugging Face
        if (!response.ok) {
            const errorText = await response.text();
            console.error("[HuggingFace API Error]:", errorText);
            
            if (response.status === 503) {
                 return res.status(503).json({ error: "الموديل يستيقظ حالياً على سيرفرات Hugging Face، يرجى تكرار الضغط بعد 10 ثوانٍ." });
            }
            return res.status(response.status).json({ error: `Hugging Face Refused: ${errorText}` });
        }

        // تحويل البيانات الثنائية الراجعة إلى Base64 بنجاح
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');

        res.json({ 
            success: true,
            imageBase64: base64Image,
            imageUrl: `data:image/jpeg;base64,${base64Image}`
        });

    } catch (error) {
        console.error("[HuggingFace Endpoint Error]:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Secure Proxy Server is actively running on port ${PORT}`);
});
