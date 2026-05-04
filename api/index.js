const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());
mongoose.connect(process.env.MONGODB_URI);
const User = mongoose.model('User', { username: String, password: String, score: { type: Number, default: 0 } });

app.post('/api/auth', async (req, res) => {
    const { username, password } = req.body;
    let user = await User.findOne({ username });
    if (!user) { user = new User({ username, password }); await user.save(); }
    else if (user.password !== password) return res.status(401).send();
    res.json(user);
});

app.get('/api/questions/:subject', (req, res) => {
    const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'questions.json'), 'utf8'));
    res.json(data[req.params.subject] || []);
});

app.post('/api/score', async (req, res) => {
    const { username, points } = req.body;
    await User.findOneAndUpdate({ username }, { $inc: { score: points } });
    res.send('ok');
});

app.get('/api/leaderboard', async (req, res) => {
    res.json(await User.find().sort({ score: -1 }).limit(20));
});
module.exports = app;
