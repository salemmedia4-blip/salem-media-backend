const express = require('express');
const cors = require('cors');
const https = require('https');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

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

// ==========================================
// 🛡️ تكتيك حل العناوين النووي DNS-over-HTTPS (DoH) عبر IP مباشر
// ==========================================
function resolveHuggingFaceIP() {
    return new Promise((resolve, reject) => {
        console.log("[DNS-over-HTTPS] 🔍 جاري حل عنوان Hugging Face عبر IP كلود فلير المباشر (1.1.1.1)...");

        // إرسال الطلب لـ Cloudflare DoH بالـ IP مباشرة لتفادي الـ DNS تماماً
        const options = {
            hostname: '1.1.1.1',
            port: 443,
            path: '/dns-query?name=api-inference.huggingface.co&type=A',
            method: 'GET',
            headers: {
                'accept': 'application/dns-json',
                'host': 'cloudflare-dns.com'
            },
            servername: 'cloudflare-dns.com', // لتأمين شهادة الـ SSL
            timeout: 5000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const ipRecord = json.Answer?.find(r => r.type === 1);
                    if (ipRecord && ipRecord.data) {
                        console.log(`[DNS-over-HTTPS] ✅ تم الحل بنجاح! IP الفعلي هو: ${ipRecord.data}`);
                        resolve(ipRecord.data);
                    } else {
                        throw new Error("لم يتم العثور على سجل IP صالح في إجابة كلود فلير.");
                    }
                } catch (e) {
                    // إذا فشل كلود فلير، نذهب لخط الدفاع الاحتياطي لـ Google DoH
                    resolveGoogleDoH(reject, resolve);
                }
            });
        });

        req.on('error', (err) => {
            console.warn("[DNS-over-HTTPS Warning] فشل كلود فلير، جاري التحويل لخادم Google DoH الاحتياطي...");
            resolveGoogleDoH(reject, resolve);
        });

        req.end();
    });
}

// خادم جوجل الاحتياطي لحل العناوين بالـ IP المباشر 8.8.8.8
function resolveGoogleDoH(reject, resolve) {
    const options = {
        hostname: '8.8.8.8',
        port: 443,
        path: '/resolve?name=api-inference.huggingface.co&type=A',
        method: 'GET',
        headers: {
            'host': 'dns.google'
        },
        servername: 'dns.google',
        timeout: 5000
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                const ipRecord = json.Answer?.find(r => r.type === 1);
                if (ipRecord && ipRecord.data) {
                    console.log(`[DNS-over-HTTPS] ✅ تم الحل بنجاح عبر جوجل! IP هو: ${ipRecord.data}`);
                    resolve(ipRecord.data);
                } else {
                    // آي بي احتياطي ثابت لـ AWS CloudFront لضمان عدم التوقف مطلقاً
                    console.warn("[DNS-over-HTTPS] فشل جوجل أيضاً. استخدام IP خوادم AWS الاحتياطي الثابت.");
                    resolve('108.138.85.50');
                }
            } catch (e) {
                resolve('108.138.85.50');
            }
        });
    });

    req.on('error', (err) => {
        console.warn("[DNS-over-HTTPS Error] فشل الحل التلقائي. استخدام IP خوادم AWS الاحتياطي الثابت.");
        resolve('108.138.85.50');
    });

    req.end();
}

app.get('/', (req, res) => {
    res.status(200).send('✅ سيرفر سالم ميديا شغال بأعلى درجات الاستقرار والحماية ضد حجب الـ DNS!');
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
// 🎨 2. أداة توليد الصور (Hugging Face FLUX بقوة الالتفاف الشبكي)
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

        // 1. حل العنوان وتخطي DNS رندر الفاشل تماماً
        const resolvedIP = await resolveHuggingFaceIP();

        const MODEL_ID = "black-forest-labs/FLUX.1-schnell";
        const payloadData = JSON.stringify({ inputs: prompt });

        // 2. استخدام الـ IP المباشر مع حقن الـ SNI لشهادة التشفير لضمان نجاح الاتصال
        const options = {
            hostname: resolvedIP, // الاتصال بالـ IP مباشرة!
            port: 443,
            path: `/models/${MODEL_ID}`,
            method: 'POST',
            headers: {
                'Host': 'api-inference.huggingface.co', // حقن الـ Host الأصلي
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadData)
            },
            servername: 'api-inference.huggingface.co', // حقن الـ SNI لنجاح تشفير SSL
            timeout: 60000
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

                const base64Image = buffer.toString('base64');
                console.log("✅ تم رسم الصورة بنجاح تام وتخطي كافة جدران الحجب!");
                
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
    console.log(`✅ [SERVER LIVE] السيرفر الإمبراطوري شغال ومُحصن بالكامل من أعطال الشبكات على منفذ ${PORT}`);
});
