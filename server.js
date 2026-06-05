const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// إعدادات الـ CORS والـ Body Parser
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// ==========================================
// 🛠️ نظام تتبع الطلبات (Debug Mode / Logger)
// ==========================================
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] 🚀 طلب جديد مستلم: ${req.method} ${req.url}`);
    next();
});

// جلب المفاتيح من بيئة Render
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// فحص صحة السيرفر
app.get('/', (req, res) => {
    res.status(200).send('✅ السيرفر يعمل بكفاءة. نظام التتبع (Debug Mode) مُفعّل.');
});

// ==========================================
// 📝 1. ممر التوليد النصي (Gemini API)
// ==========================================
app.post('/api/generate', async (req, res) => {
    console.log("-> 📝 بدء معالجة طلب نصوص (Gemini)...");
    try {
        if (!GEMINI_API_KEY) {
            console.error("❌ خطأ: مفتاح GEMINI_API_KEY غير موجود في Render!");
            return res.status(401).json({ error: "مفتاح الـ API الخاص بجوجل غير معرّف في السيرفر." });
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
            console.error("❌ خطأ من خوادم جوجل:", data);
            return res.status(response.status).json(data);
        }

        console.log("✅ تم توليد النص بنجاح وإرساله للتطبيق.");
        res.json(data);
    } catch (error) {
        console.error("❌ [Text Gen Internal Error]:", error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 🎨 2. ممر توليد الصور (Hugging Face FLUX API)
// ==========================================
app.post('/api/generate-image', async (req, res) => {
    console.log("-> 🎨 بدء معالجة طلب رسم صورة (Hugging Face)...");
    try {
        if (!HUGGINGFACE_API_KEY) {
            console.error("❌ خطأ: مفتاح HUGGINGFACE_API_KEY غير موجود في Render!");
            return res.status(401).json({ error: "مفتاح Hugging Face غير معرّف في السيرفر." });
        }

        const { prompt } = req.body;
        if (!prompt) {
            console.warn("⚠️ الطلب وصل بدون نص إعلاني (Prompt).");
            return res.status(400).json({ error: "يرجى كتابة موجه إعلاني للرسم." });
        }

        console.log(`-> 🎨 الموجه المطلوب رسمه: "${prompt}"`);

        const MODEL_ID = "black-forest-labs/FLUX.1-schnell";
        const url = `https://api-inference.huggingface.co/models/${MODEL_ID}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: prompt })
        });

        // 🛠️ الإصلاح الجذري: التحقق من نوع الرد (Content-Type)
        const contentType = response.headers.get('content-type');

        if (!response.ok) {
            // إذا كان الخطأ بصيغة JSON (مثل: الموديل يحمل)
            if (contentType && contentType.includes('application/json')) {
                const errData = await response.json();
                console.error("❌ [HuggingFace API Error]:", errData);
                
                if (errData.error && errData.error.includes("loading")) {
                    return res.status(503).json({ error: "السيرفر يجهز أدوات الرسم (الموديل قيد التحميل)، يرجى الانتظار 30 ثانية والمحاولة مرة أخرى." });
                }
                return res.status(response.status).json({ error: errData.error || "فشل غير معروف من Hugging Face." });
            } else {
                // إذا كان الخطأ نصي عادي
                const errText = await response.text();
                console.error("❌ [HuggingFace Text Error]:", errText);
                return res.status(response.status).json({ error: `فشل الاتصال: ${errText}` });
            }
        }

        // ✅ إذا نجح الطلب، نتأكد إنه راجع كصورة (image/jpeg أو image/png)
        if (contentType && (contentType.includes('image/jpeg') || contentType.includes('image/png'))) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64Image = buffer.toString('base64');
            
            console.log("✅ تم توليد الصورة بنجاح وتحويلها لـ Base64.");
            
            res.json({ 
                success: true,
                imageUrl: `data:${contentType};base64,${base64Image}`
            });
        } else {
            // إذا رجع شيء غريب مو صورة ولا خطأ معروف
            const weirdData = await response.text();
            console.error("❌ [Unexpected Response]:", weirdData);
            res.status(500).json({ error: "استجابة غير متوقعة من خوادم الرسم." });
        }

    } catch (error) {
        console.error("❌ [Image Gen Internal Error]:", error);
        res.status(500).json({ error: `خطأ داخلي في السيرفر: ${error.message}` });
    }
});

app.listen(PORT, () => {
    console.log(`✅ [SERVER STARTED] السيرفر يعمل الآن على منفذ ${PORT} ومستعد لاستقبال الطلبات.`);
});
