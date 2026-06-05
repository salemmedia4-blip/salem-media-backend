const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // إجبار Node على استخدام IPv4 لمنع أخطاء الـ DNS

const express = require('express');
const cors = require('cors');
const https = require('https');
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
// 🛠️ نظام تتبع الطلبات (Debug Mode)
// ==========================================
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] 🚀 طلب مستلم: ${req.method} ${req.url}`);
    next();
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

app.get('/', (req, res) => {
    res.status(200).send('✅ السيرفر الإمبراطوري المحدث يعمل بكفاءة تامة ومضاد لأعطال الشبكة!');
});

// ==========================================
// 📝 1. ممر التوليد النصي (Gemini API المحدث والاستقرار 100%)
// ==========================================
app.post('/api/generate', async (req, res) => {
    console.log("-> 📝 بدء معالجة طلب نصوص (Gemini)...");
    try {
        if (!GEMINI_API_KEY) {
            console.error("❌ خطأ: مفتاح GEMINI_API_KEY غير موجود في Render!");
            return res.status(401).json({ error: "مفتاح Gemini API غير معرّف في بيئة Render." });
        }

        // استخدام الموديل المستقر والإنتاجي المعتمد
        const model = "gemini-1.5-flash";
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
        console.error("❌ [Text Gen Error]:", error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 🎨 2. ممر توليد الصور باستخدام https الأصلي (بشرى سارة: مضاد لـ ENOTFOUND)
// ==========================================
app.post('/api/generate-image', async (req, res) => {
    console.log("-> 🎨 بدء معالجة طلب رسم صورة (Hugging Face HTTPS)...");
    try {
        if (!HUGGINGFACE_API_KEY) {
            console.error("❌ خطأ: مفتاح HUGGINGFACE_API_KEY غير موجود في Render!");
            return res.status(401).json({ error: "مفتاح Hugging Face غير معرّف." });
        }

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "يرجى كتابة موجه إعلاني للرسم." });
        }

        console.log(`-> 🎨 الموجه المطلوب رسمه: "${prompt}"`);

        // صياغة الطلب باستخدام مكتبة HTTPS الأساسية لحل مشكلة الـ DNS حتمياً
        const payload = JSON.stringify({ 
            inputs: prompt,
            options: { wait_for_model: true } 
        });

        const options = {
            hostname: 'api-inference.huggingface.co',
            path: '/models/black-forest-labs/FLUX.1-schnell',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 60000 // مهلة انتظار حتى دقيقة كاملة لاستيقاظ الموديل
        };

        const reqHF = https.request(options, (resHF) => {
            const chunks = [];
            resHF.on('data', (chunk) => chunks.push(chunk));
            
            resHF.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const contentType = resHF.headers['content-type'];

                if (resHF.statusCode !== 200) {
                    let errorMessage = `HTTP Error ${resHF.statusCode}`;
                    try {
                        const errJson = JSON.parse(buffer.toString());
                        errorMessage = errJson.error || errorMessage;
                    } catch (e) {}
                    console.error("❌ [Hugging Face Error Response]:", errorMessage);
                    return res.status(resHF.statusCode).json({ error: errorMessage });
                }

                // تحويل البيانات الثنائية للصورة إلى Base64 بنجاح
                const base64Image = buffer.toString('base64');
                console.log("✅ تم رسم الصورة بنجاح وتوليد Base64.");
                
                res.json({
                    success: true,
                    imageUrl: `data:${contentType || 'image/jpeg'};base64,${base64Image}`
                });
            });
        });

        reqHF.on('error', (err) => {
            console.error("❌ [HTTPS Request Connection Error]:", err);
            res.status(500).json({ error: `خطأ اتصال شبكي: ${err.message}` });
        });

        reqHF.on('timeout', () => {
            reqHF.destroy();
            console.error("❌ [Hugging Face Timeout Error]");
            res.status(504).json({ error: "انتهت مهلة الاتصال بخوادم الرسم، يرجى المحاولة مرة أخرى." });
        });

        reqHF.write(payload);
        reqHF.end();

    } catch (error) {
        console.error("❌ [Fatal Image Gen Error]:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ [SYSTEM LIVE] السيرفر يعمل الآن على منفذ ${PORT} ومؤمن 100%.`);
});
