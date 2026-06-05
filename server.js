// 🛠️ الحل السحري والنهائي لمشكلة (ENOTFOUND) في خوادم Render!
// نقوم بإنشاء مترجم DNS مخصص يتصل مباشرة بـ Cloudflare و Google لتفادي أعطال رندر
const dns = require('dns');
const https = require('https');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// إعداد مترجم DNS سحابي خاص بداخل السيرفر
const resolver = new dns.Resolver();
resolver.setServers(['1.1.1.1', '8.8.8.8']); // استخدام كلود فلير وجوجل كخوادم أساسية

// دالة مخصصة لحل العناوين تتجاوز شبكة رندر وتعمل بكفاءة مطلقة
function customLookup(hostname, options, callback) {
    resolver.resolve4(hostname, (err, addresses) => {
        if (!err && addresses && addresses.length > 0) {
            // نجح الترجمان الخاص بنا في جلب الآي بي الفعلي
            callback(null, addresses[0], 4);
        } else {
            // خط دفاع احتياطي: في حال تعطل الترجمان، نعود للبحث الافتراضي
            dns.lookup(hostname, options, callback);
        }
    });
}

// إعدادات الـ CORS لضمان استقبال الطلبات من تطبيقك
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// نظام التتبع لطباعة الطلبات في الـ Logs
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] 🚀 طلب مستلم: ${req.method} ${req.url}`);
    next();
});

// جلب المفاتيح من بيئة Render
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

app.get('/', (req, res) => {
    res.status(200).send('✅ سيرفر سالم ميديا يعمل بامتياز. تم حل مشكلة الـ DNS الفاشل عبر نظام المترجم الخاص!');
});

// ==========================================
// 📝 1. أدوات النصوص (Gemini 2.5 Flash المستقر والمجاني)
// ==========================================
app.post('/api/generate', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            throw new Error("مفتاح GEMINI مفقود في إعدادات Render.");
        }

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
// 🎨 2. أداة توليد الصور (Hugging Face FLUX بقوة الاتصال المحمي)
// ==========================================
app.post('/api/generate-image', async (req, res) => {
    try {
        if (!HUGGINGFACE_API_KEY) {
            throw new Error("مفتاح HUGGINGFACE مفقود في إعدادات Render.");
        }

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "يرجى كتابة موجه إعلاني." });
        }

        console.log(`🎨 جاري تحضير طلب الرسم للموجه: "${prompt}"...`);

        const MODEL_ID = "black-forest-labs/FLUX.1-schnell";
        const payloadData = JSON.stringify({ inputs: prompt });

        // بناء خيارات الطلب الشبكي عبر الموديل الأصلي لضمان تخطي جدران الأمان وحقن المترجم الخاص
        const options = {
            hostname: 'api-inference.huggingface.co',
            path: `/models/${MODEL_ID}`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadData)
            },
            lookup: customLookup, // 🛠️ حقن مترجم الـ DNS السحابي الخاص هنا لتجنب ENOTFOUND قطعيّاً!
            timeout: 60000 // مهلة انتظار كافية لاستيقاظ الموديل
        };

        const hfRequest = https.request(options, (hfResponse) => {
            const chunks = [];
            
            hfResponse.on('data', (chunk) => chunks.push(chunk));
            
            hfResponse.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const contentType = hfResponse.headers['content-type'] || '';

                if (hfResponse.statusCode !== 200) {
                    const errorMsg = buffer.toString('utf8');
                    console.error("❌ [Hugging Face Response Error]:", errorMsg);
                    return res.status(hfResponse.statusCode).json({ error: `فشل التوليد: ${errorMsg}` });
                }

                // تحويل بايتات الصورة الثنائية الصافية لـ Base64 الفخم لعرضه بالتطبيق
                const base64Image = buffer.toString('base64');
                console.log("✅ تم رسم الصورة بنجاح وتجاوز جدار حماية رندر!");
                
                res.json({
                    success: true,
                    imageUrl: `data:${contentType || 'image/jpeg'};base64,${base64Image}`
                });
            });
        });

        hfRequest.on('error', (err) => {
            console.error("❌ [HTTPS Request Connection Error]:", err);
            res.status(500).json({ error: `خطأ اتصال بمحرك الرسم السحابي: ${err.message}` });
        });

        hfRequest.write(payloadData);
        hfRequest.end();

    } catch (error) {
        console.error("❌ [Image Gen Error]:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ [SERVER LIVE] السيرفر الإمبراطوري شغال ومحمي بنظام DNS مخصص على منفذ ${PORT}`);
});
