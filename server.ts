import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const db = new Database("bouldering.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image1 TEXT,
    image2 TEXT,
    image3 TEXT,
    extra_info TEXT,
    grade_range TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Add official_grade and is_verified if they don't exist
try {
  db.exec("ALTER TABLE routes ADD COLUMN official_grade TEXT");
} catch (e) {
  // Column might already exist
}
try {
  db.exec("ALTER TABLE routes ADD COLUMN is_verified INTEGER DEFAULT 0");
} catch (e) {
  // Column might already exist
}

async function startServer() {
  console.log("Starting BetaGrade AI Server...");
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  const apiRouter = express.Router();

  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  apiRouter.get("/routes", (req, res) => {
    try {
      const routes = db.prepare("SELECT * FROM routes ORDER BY created_at DESC").all();
      res.json(routes);
    } catch (error) {
      console.error("Fetch error:", error);
      res.status(500).json({ error: "Failed to fetch routes" });
    }
  });

  apiRouter.get("/training-data", (req, res) => {
    try {
      const examples = db.prepare("SELECT grade_range, official_grade, extra_info, description FROM routes WHERE is_verified = 1 OR official_grade IS NOT NULL LIMIT 10").all();
      res.json(examples);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch training data" });
    }
  });

  apiRouter.post("/routes", (req, res) => {
    const { image1, image2, image3, extra_info, grade_range, description, official_grade, is_verified } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO routes (image1, image2, image3, extra_info, grade_range, description, official_grade, is_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(image1, image2, image3, extra_info, grade_range, description, official_grade || null, is_verified ? 1 : 0);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      console.error("Insert error:", error);
      res.status(500).json({ error: "Failed to save route" });
    }
  });

  apiRouter.patch("/routes/:id", (req, res) => {
    const { id } = req.params;
    const { official_grade } = req.body;
    try {
      const stmt = db.prepare("UPDATE routes SET official_grade = ? WHERE id = ?");
      stmt.run(official_grade, id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update grade" });
    }
  });

  app.use("/api", apiRouter);

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Vite dev middleware...");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
      },
      appType: "spa",
    });
    
    app.use(vite.middlewares);

    // Fallback to index.html for SPA routing
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) return next();
      
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        
        // Inject runtime environment variables
        const envScript = `<script>window.process = window.process || {}; window.process.env = window.process.env || {}; window.process.env.VITE_GEMINI_API_KEY = ${JSON.stringify(process.env.VITE_GEMINI_API_KEY || '')};</script>`;
        template = template.replace('</head>', `${envScript}</head>`);
        
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    console.log("Setting up production static serving...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.get("*", (req, res) => {
      let template = fs.readFileSync(path.join(distPath, "index.html"), 'utf-8');
      const envScript = `<script>window.process = window.process || {}; window.process.env = window.process.env || {}; window.process.env.VITE_GEMINI_API_KEY = ${JSON.stringify(process.env.VITE_GEMINI_API_KEY || '')};</script>`;
      template = template.replace('</head>', `${envScript}</head>`);
      res.send(template);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server ready at http://0.0.0.0:${PORT}`);
  });
}

startServer();
