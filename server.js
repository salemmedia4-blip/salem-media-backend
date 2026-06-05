// 🛠️ التكوين الفولاذي لحل مشكلات DNS وشبكات Render
require('dns').setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const https = require('https'); // الموديل الأصلي لضمان اتصال IPv4 آمن ومستقر
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// نظام التتبع في الـ Logs
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] 🚀 طلب مستلم: ${req.method} ${req.url}`);
    next();
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

app.get('/', (req, res) => {
    res.status(200).send('✅ خادم سالم ميديا الفولاذي نشط الآن ومحصن ضد كافة أخطاء الشبكات والـ DNS!');
});

// ==========================================
// 📝 1. ممر النصوص (Gemini 2.5 Flash المستقر)
// ==========================================
app.post('/api/generate', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            throw new Error("مفتاح GEMINI_API_KEY مفقود في إعدادات Render.");
        }

        // الترقية للموديل المستقر المعتمد حالياً
        const model = "gemini-2.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error("❌ [Gemini API Error]:", data);
            throw new Error(data.error?.message || "حدث خطأ من سيرفرات جوجل.");
        }

        console.log("✅ تم توليد النصوص بنجاح وإرسالها للواجهة!");
        res.json(data);
    } catch (error) {
        console.error("❌ [Text Gen Error]:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 🎨 2. ممر الصور (Hugging Face FLUX عبر اتصال IPv4 الحصري)
// ==========================================
app.post('/api/generate-image', async (req, res) => {
    try {
        if (!HUGGINGFACE_API_KEY) {
            throw new Error("مفتاح HUGGINGFACE_API_KEY مفقود في إعدادات Render.");
        }

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "يرجى كتابة موجه إعلاني للرسم." });
        }

        console.log(`🎨 جاري رسم الموجه: "${prompt}"...`);

        const MODEL_ID = "black-forest-labs/FLUX.1-schnell";
        const targetUrl = `https://api-inference.huggingface.co/models/${MODEL_ID}`;

        // إرسال الطلب عبر دالة HTTPS مخصصة تجبر بروتوكول IPv4 وتتجاوز عيوب undici/fetch
        const result = await httpsPostIPv4(
            targetUrl,
            {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            JSON.stringify({ inputs: prompt })
        );

        if (!result.ok) {
            if (result.status === 503) {
                throw new Error("محرك الرسم قيد التحميل حالياً للتشغيل المجاني، يرجى إعادة المحاولة بعد 20 ثانية لتهيئة السيرفر.");
            }
            throw new Error(`خطأ من HuggingFace (كود ${result.status})`);
        }

        // تحويل بايتات الصورة المستلمة لـ Base64 لتعرض فوراً في الجوال
        const base64Image = result.buffer.toString('base64');
        console.log("✅ تم رسم الصورة بنجاح وتأمينها عبر اتصال IPv4!");

        res.json({
            success: true,
            imageUrl: `data:image/jpeg;base64,${base64Image}`
        });

    } catch (error) {
        console.error("❌ [Image Gen Error]:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// دالة الاتصال الحصرية المفرقة لشبكات IPv4 (تتجاوز خطأ ENOTFOUND تماماً)
function httpsPostIPv4(url, headers, body) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: headers,
            family: 4, // فرض الاتصال عبر IPv4 لتفادي انهيار DNS في رندر
            timeout: 60000 // مهلة انتظار 60 ثانية لاستيقاظ الموديل
        };

        const req = https.request(options, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    headers: res.headers,
                    buffer: Buffer.concat(chunks)
                });
            });
        });

        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error("انتهت مهلة الاتصال بالخادم (60 ثانية)، يرجى تكرار المحاولة لتنشيط الموديل."));
        });

        req.write(body);
        req.end();
    });
}

app.listen(PORT, () => {
    console.log(`✅ [SERVER STARTED] السيرفر شغال وجاهز لاستقبال الطلبات على منفذ ${PORT}`);
});
