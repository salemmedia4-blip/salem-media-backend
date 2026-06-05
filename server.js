const express = require('express');
const cors = require('cors');
const https = require('https'); // استخدام الموديل الأصلي لضمان استقرار الشبكة وتفادي أخطاء fetch الافتراضية
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

// دالة سحرية تستخدم بروتوكول HTTPS الصرف وتجبر الاتصال على IPv4 لتفادي مشاكل الـ fetch
function queryHuggingFaceDirect(prompt, apiKey) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            inputs: prompt,
            options: { wait_for_model: true } // الانتظار الإلزامي لاستيقاظ الموديل
        });

        const options = {
            hostname: 'api-inference.huggingface.co',
            port: 443,
            path: '/models/black-forest-labs/FLUX.1-schnell',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'SalemMediaApp/1.0'
            },
            family: 4, // ⚡ السر العسكري: إجبار السيرفر على استخدام IPv4 لمنع أخطاء DNS و network dropouts
            timeout: 60000 // مهلة دقيقة كاملة لضمان اكتمال الرسم
        };

        const req = https.request(options, (res) => {
            // معالجة الأخطاء وإرجاع رسالة الخطأ الحقيقية القادمة من Hugging Face
            if (res.statusCode !== 200) {
                let errorBody = '';
                res.on('data', chunk => errorBody += chunk);
                res.on('end', () => {
                    reject(new Error(`HuggingFace_HTTP_${res.statusCode}: ${errorBody}`));
                });
                return;
            }

            // استقبال البيانات الثنائية للصورة
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('انتهت مهلة الاتصال بخادم الرسم السحابي (60 ثانية). يرجى إعادة المحاولة.'));
        });

        req.write(postData);
        req.end();
    });
}

// 2. ممر توليد الصور الآمن والذكي عبر FLUX
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

        // الاتصال بالخادم المطور والآمن
        const imageBuffer = await queryHuggingFaceDirect(prompt, HUGGINGFACE_API_KEY);

        // تحويل الصورة الثنائية إلى صيغة Base64 لإرسالها للواجهة
        const base64Image = imageBuffer.toString('base64');

        res.json({ 
            success: true,
            imageBase64: base64Image,
            imageUrl: `data:image/jpeg;base64,${base64Image}`
        });

    } catch (error) {
        console.error("[HuggingFace Endpoint Error]:", error.message);
        
        // إظهار سبب الخطأ الفعلي للتسهيل على المستخدم معرفة حالة المفتاح
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
