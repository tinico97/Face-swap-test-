
import "dotenv/config";
import express from "express";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 10000);
const tmpDir = path.join(__dirname, "tmp");
const templatePath = path.join(__dirname, "templates", "dragon-hero.png");
const maskPath = path.join(__dirname, "templates", "dragon-hero-mask.png");

fs.mkdirSync(tmpDir, { recursive:true });

const upload = multer({
  dest: tmpDir,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ok = ["image/jpeg","image/png","image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Format non supporté : JPEG, PNG ou WEBP uniquement."), ok);
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req,res) => {
  res.json({
    ok:true,
    service:"dragon-face-test",
    model:"gpt-image-2",
    template:"fixed-dragon-hero",
    keyConfigured:Boolean(process.env.OPENAI_API_KEY)
  });
});

app.post("/api/preview", upload.single("photo"), async (req,res) => {
  const requestId = crypto.randomUUID().slice(0,8);
  const started = Date.now();
  let uploaded = req.file?.path;

  console.log(`[${requestId}] preview request received`);

  try {
    if (!req.file) {
      return res.status(400).json({ok:false,error:"Aucune photo reçue.",requestId});
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ok:false,error:"OPENAI_API_KEY absente sur Render.",requestId});
    }

    const meta = await sharp(uploaded).metadata();
    if ((meta.width || 0) < 512 || (meta.height || 0) < 512) {
      return res.status(422).json({
        ok:false,
        error:"Photo trop petite. Utilise une photo d’au moins 512 × 512 px.",
        requestId
      });
    }

    console.log(`[${requestId}] input ${meta.width}x${meta.height}; calling OpenAI`);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const template = await toFile(
      fs.createReadStream(templatePath),
      "dragon-hero.png",
      { type:"image/png" }
    );
    const source = await toFile(
      fs.createReadStream(uploaded),
      req.file.originalname || "identity-reference.jpg",
      { type:req.file.mimetype }
    );
    const mask = await toFile(
      fs.createReadStream(maskPath),
      "dragon-hero-mask.png",
      { type:"image/png" }
    );

    const prompt = `
EDIT THE FIXED POSTER, DO NOT RECREATE IT.

IMAGE 1 = immutable Dragon Hero poster.
IMAGE 2 = customer's real identity reference.
MASK = only editable head / hair / upper-neck region on IMAGE 1.

GOAL:
Replace ONLY the masked head region so that the child in IMAGE 1 is immediately
recognizable as the exact person in IMAGE 2, while keeping the poster itself unchanged.

IDENTITY IS THE ABSOLUTE PRIORITY:
preserve the person's real facial geometry and proportions, eye shape and spacing,
eyebrows, nose, lips, cheeks, jawline, forehead, ears where visible, skin tone,
apparent age and natural hair texture. Do not beautify, average, stylize, age,
or invent a generic face.

FACE RENDERING:
photographic facial detail, natural skin texture, realistic pores, realistic eyes,
closed mouth, calm confident expression. No doll skin. No anime/cartoon face.
No second face. Nothing over the eyes.

INTEGRATION:
match the existing warm golden light and shadow direction of the poster.
Blend hairline, ears, jaw, neck and skin transitions naturally.
No pasted-face seam, halo, mismatched skin color or floating head.

LOCK EVERYTHING OUTSIDE THE MASK:
do not change the dragon/firebird, body, crimson martial-arts gi, sash, wraps,
arms, fists, legs, rocks, canyon, golden energy column, lightning, typography,
LUCAS text, III numeral, framing, composition, camera angle, color palette
or any background pixel intentionally.

If preserving the real identity conflicts with stylistic reinterpretation,
preserve identity.
`;

    const result = await client.images.edit({
      model:"gpt-image-2",
      image:[template, source],
      mask,
      prompt,
      quality:process.env.QUALITY || "medium",
      size:"1024x1536",
      output_format:"jpeg",
      output_compression:94
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("OpenAI n'a renvoyé aucune image.");
    }

    console.log(`[${requestId}] completed in ${Date.now()-started} ms`);

    // Return directly as data URL: no storage, no second fetch, no CORS, no Shopify.
    res.json({
      ok:true,
      requestId,
      elapsedMs:Date.now()-started,
      image:`data:image/jpeg;base64,${b64}`
    });

  } catch (err) {
    console.error(`[${requestId}]`, err);
    const message =
      err?.error?.message ||
      err?.response?.data?.error?.message ||
      err?.message ||
      "Erreur inconnue.";

    res.status(500).json({
      ok:false,
      requestId,
      error:message
    });
  } finally {
    if (uploaded) fs.rm(uploaded, {force:true}, ()=>{});
  }
});

app.use((err,req,res,next) => {
  console.error("middleware error", err);
  res.status(400).json({ok:false,error:err?.message || "Requête invalide."});
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Dragon Face Test listening on 0.0.0.0:${port}`);
});
