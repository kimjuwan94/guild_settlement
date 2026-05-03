const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 기본 데이터 구조
const initialData = {
    guilds: [],
    members: [],
    settlementHistory: [],
    lastFinalizedWeek: null
};

// 서버 시작 시 DB 파일이 없으면 생성
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
}

// GET API: 전체 데이터 조회
app.get('/api/data', (req, res) => {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        console.error('Error reading database:', e);
        res.status(500).json({ error: 'Failed to read database' });
    }
});

// POST API: 전체 데이터 덮어쓰기 (Optimistic Update)
app.post('/api/data', (req, res) => {
    try {
        const newData = req.body;
        // JSON 형태 확인 및 파일 저장
        fs.writeFileSync(DB_FILE, JSON.stringify(newData, null, 2), 'utf8');
        res.json({ success: true });
    } catch (e) {
        console.error('Error writing database:', e);
        res.status(500).json({ error: 'Failed to save database' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 [서버 실행됨] 길드 정산 시스템 백엔드가 포트 ${PORT}에서 작동 중입니다.`);
    console.log(`📁 데이터베이스 파일 위치: ${DB_FILE}`);
});
