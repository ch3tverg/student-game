const express = require('express');
const { kv } = require('@vercel/kv');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Вход и Регистрация
app.post('/api/auth', async (req, res) => {
    const { username, password } = req.body;
    // Ищем пароль пользователя в базе Vercel
    const storedPassword = await kv.get(`user:${username}`);
    
    if (!storedPassword) {
        // Если пользователя нет — регистрируем
        await kv.set(`user:${username}`, password);
        await kv.zadd('leaderboard', { score: 0, member: username });
        return res.json({ username, score: 0 });
    } else if (storedPassword !== password) {
        return res.status(401).send();
    }
    
    const score = await kv.zscore('leaderboard', username);
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
    // Прибавляем баллы в общий рейтинг
    await kv.zincrby('leaderboard', points, username);
    res.send('ok');
});

// Рейтинг лидеров
app.get('/api/leaderboard', async (req, res) => {
    // Получаем топ-20 игроков
    const top = await kv.zrange('leaderboard', 0, 19, { rev: true, withScores: true });
    const formatted = [];
    for (let i = 0; i < top.length; i += 2) {
        formatted.push({ username: top[i], score: top[i+1] });
    }
    res.json(formatted);
});

module.exports = app;
