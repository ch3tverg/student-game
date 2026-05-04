const express = require('express');
const { kv } = require('@vercel/kv');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());

// 1. ХАРДКОРНАЯ РЕГИСТРАЦИЯ
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    // Проверка: есть ли уже такой ник?
    const exists = await kv.get(`user:${username}`);
    if (exists) {
        return res.status(409).json({ error: 'Пользователь с таким ником уже существует!' });
    }

    // Шифруем пароль (10 циклов соли)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Сохраняем в базу зашифрованный пароль
    await kv.set(`user:${username}`, hashedPassword);
    await kv.zadd('leaderboard', { score: 0, member: username });
    
    res.status(201).json({ message: 'Регистрация успешна' });
});

// 2. ХАРДКОРНЫЙ ЛОГИН
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    // Достаем хеш из базы
    const storedHash = await kv.get(`user:${username}`);
    if (!storedHash) {
        return res.status(404).json({ error: 'Пользователь не найден. Сначала зарегистрируйтесь!' });
    }

    // Сравниваем введенный пароль с хешем
    const isMatch = await bcrypt.compare(password, storedHash);
    if (!isMatch) {
        return res.status(401).json({ error: 'Неверный пароль!' });
    }

    const score = await kv.zscore('leaderboard', username) || 0;
    res.json({ username, score });
});

// Загрузка вопросов
app.get('/api/questions/:subject', (req, res) => {
    const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'questions.json'), 'utf8'));
    res.json(data[req.params.subject] || []);
});

// Обновление баллов
app.post('/api/score', async (req, res) => {
    const { username, points } = req.body;
    await kv.zincrby('leaderboard', points, username);
    res.send('ok');
});

// Таблица лидеров
app.get('/api/leaderboard', async (req, res) => {
    const top = await kv.zrange('leaderboard', 0, 19, { rev: true, withScores: true });
    const formatted = [];
    for (let i = 0; i < top.length; i += 2) {
        formatted.push({ username: top[i], score: top[i+1] });
    }
    res.json(formatted);
});

module.exports = app;
