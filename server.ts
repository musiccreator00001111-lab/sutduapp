import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;
  const db = new Database("studybuddy.db");

  // Initialize database tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      avatar TEXT
    );
    CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      badge_name TEXT,
      icon TEXT,
      date_earned DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      subject TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task TEXT NOT NULL,
      time TEXT,
      day TEXT,
      completed INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT,
      score INTEGER,
      total INTEGER,
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER,
      user_id INTEGER,
      role TEXT DEFAULT 'member',
      PRIMARY KEY (group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS group_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER,
      user_id INTEGER,
      text TEXT,
      image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS group_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER,
      title TEXT NOT NULL,
      content TEXT,
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Seed a default user if none exists
    INSERT OR IGNORE INTO users (id, name, points, level) VALUES (1, 'Rohit Yadav', 0, 1);
    -- Seed some dummy users for leaderboard
    INSERT OR IGNORE INTO users (id, name, points, level) VALUES (2, 'Alice Smith', 450, 5);
    INSERT OR IGNORE INTO users (id, name, points, level) VALUES (3, 'Bob Johnson', 320, 3);
    INSERT OR IGNORE INTO users (id, name, points, level) VALUES (4, 'Charlie Brown', 150, 2);
  `);

  app.use(express.json());

  // Gamification Helper
  const addPoints = (userId, points) => {
    db.prepare("UPDATE users SET points = points + ? WHERE id = ?").run(points, userId);
    // Simple level up logic: every 100 points
    db.prepare("UPDATE users SET level = (points / 100) + 1 WHERE id = ?").run(userId);
  };

  // API Routes
  app.get("/api/user/:id", (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    const badges = db.prepare("SELECT * FROM badges WHERE user_id = ?").all(req.params.id);
    res.json({ ...user, badges });
  });

  app.get("/api/leaderboard", (req, res) => {
    const leaderboard = db.prepare("SELECT name, points, level FROM users ORDER BY points DESC LIMIT 10").all();
    res.json(leaderboard);
  });

  app.post("/api/user/:id/points", (req, res) => {
    const { points } = req.body;
    addPoints(req.params.id, points);
    res.json({ success: true });
  });

  app.post("/api/user/:id/badge", (req, res) => {
    const { badge_name, icon } = req.body;
    // Check if badge already exists
    const exists = db.prepare("SELECT id FROM badges WHERE user_id = ? AND badge_name = ?").get(req.params.id, badge_name);
    if (!exists) {
      db.prepare("INSERT INTO badges (user_id, badge_name, icon) VALUES (?, ?, ?)").run(req.params.id, badge_name, icon);
      res.json({ success: true, unlocked: true });
    } else {
      res.json({ success: true, unlocked: false });
    }
  });
  app.get("/api/notes", (req, res) => {
    const notes = db.prepare("SELECT * FROM notes ORDER BY updated_at DESC").all();
    res.json(notes);
  });

  app.post("/api/notes", (req, res) => {
    const { title, content, subject } = req.body;
    const result = db.prepare("INSERT INTO notes (title, content, subject) VALUES (?, ?, ?)").run(title, content, subject);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/notes/:id", (req, res) => {
    const { title, content, subject } = req.body;
    db.prepare("UPDATE notes SET title = ?, content = ?, subject = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(title, content, subject, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/notes/:id", (req, res) => {
    db.prepare("DELETE FROM notes WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/schedule", (req, res) => {
    const schedule = db.prepare("SELECT * FROM schedule").all();
    res.json(schedule);
  });

  app.post("/api/schedule", (req, res) => {
    const { task, time, day } = req.body;
    const result = db.prepare("INSERT INTO schedule (task, time, day) VALUES (?, ?, ?)").run(task, time, day);
    res.json({ id: result.lastInsertRowid });
  });

  app.patch("/api/schedule/:id", (req, res) => {
    const { completed } = req.body;
    db.prepare("UPDATE schedule SET completed = ? WHERE id = ?").run(completed ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/schedule/:id", (req, res) => {
    db.prepare("DELETE FROM schedule WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/progress", (req, res) => {
    const progress = db.prepare("SELECT * FROM progress ORDER BY date DESC").all();
    res.json(progress);
  });

  app.post("/api/progress", (req, res) => {
    const { subject, score, total } = req.body;
    db.prepare("INSERT INTO progress (subject, score, total) VALUES (?, ?, ?)").run(subject, score, total);
    res.json({ success: true });
  });

  // Group API Routes
  app.get("/api/groups", (req, res) => {
    const groups = db.prepare(`
      SELECT g.*, (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count 
      FROM groups g
    `).all();
    res.json(groups);
  });

  app.get("/api/groups/user/:userId", (req, res) => {
    const groups = db.prepare(`
      SELECT g.*, (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count 
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
    `).all(req.params.userId);
    res.json(groups);
  });

  app.post("/api/groups", (req, res) => {
    const { name, description, userId } = req.body;
    const result = db.prepare("INSERT INTO groups (name, description, created_by) VALUES (?, ?, ?)").run(name, description, userId);
    const groupId = result.lastInsertRowid;
    db.prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)").run(groupId, userId, 'admin');
    res.json({ id: groupId });
  });

  app.post("/api/groups/:id/join", (req, res) => {
    const { userId } = req.body;
    try {
      db.prepare("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)").run(req.params.id, userId);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: "Already a member or group doesn't exist" });
    }
  });

  app.get("/api/groups/:id/messages", (req, res) => {
    const messages = db.prepare(`
      SELECT gm.*, u.name as user_name 
      FROM group_messages gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY gm.created_at ASC
    `).all(req.params.id);
    res.json(messages);
  });

  app.get("/api/groups/:id/notes", (req, res) => {
    const notes = db.prepare(`
      SELECT gn.*, u.name as updated_by_name 
      FROM group_notes gn
      JOIN users u ON gn.updated_by = u.id
      WHERE gn.group_id = ?
      ORDER BY gn.updated_at DESC
    `).all(req.params.id);
    res.json(notes);
  });

  app.post("/api/groups/:id/notes", (req, res) => {
    const { title, content, userId } = req.body;
    const result = db.prepare("INSERT INTO group_notes (group_id, title, content, updated_by) VALUES (?, ?, ?, ?)").run(req.params.id, title, content, userId);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/groups/notes/:noteId", (req, res) => {
    const { title, content, userId } = req.body;
    db.prepare("UPDATE group_notes SET title = ?, content = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(title, content, userId, req.params.noteId);
    res.json({ success: true });
  });

  // Socket.io Logic
  io.on("connection", (socket) => {
    socket.on("join-group", (groupId) => {
      socket.join(`group-${groupId}`);
    });

    socket.on("send-message", (data) => {
      const { groupId, userId, text, image } = data;
      const result = db.prepare("INSERT INTO group_messages (group_id, user_id, text, image) VALUES (?, ?, ?, ?)").run(groupId, userId, text, image);
      const user = db.prepare("SELECT name FROM users WHERE id = ?").get(userId);
      
      const newMessage = {
        id: result.lastInsertRowid,
        group_id: groupId,
        user_id: userId,
        user_name: user.name,
        text,
        image,
        created_at: new Date().toISOString()
      };

      io.to(`group-${groupId}`).emit("new-message", newMessage);
    });

    socket.on("update-note", (data) => {
      const { noteId, groupId, title, content, userId } = data;
      db.prepare("UPDATE group_notes SET title = ?, content = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(title, content, userId, noteId);
      const user = db.prepare("SELECT name FROM users WHERE id = ?").get(userId);
      
      const updatedNote = {
        id: noteId,
        group_id: groupId,
        title,
        content,
        updated_by: userId,
        updated_by_name: user.name,
        updated_at: new Date().toISOString()
      };

      io.to(`group-${groupId}`).emit("note-updated", updatedNote);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
