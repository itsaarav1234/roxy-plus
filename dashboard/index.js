const express = require('express');
const path = require('path');
const fs = require('fs');
const QuestManager = require('../quests/manager'); // Import QuestManager
const app = express();

module.exports = (client) => {
    const port = process.env.PORT || 3000;

    // Initialize Quest Manager
    const questManager = new QuestManager(process.env.TOKEN || client.token);

    // Set view engine
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));

    // Static files
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json()); // Add JSON body parser for AJAX

    app.get('/', (req, res) => {
        if (!client.user) {
            return res.send('Bot is not ready yet. Please refresh in a moment.');
        }

        // Calculate initial uptime in seconds
        const uptimeSeconds = Math.floor(client.uptime / 1000);

        // Get status
        let status = 'offline';
        if (client.user.presence) {
            status = client.user.presence.status;
        } else {
            status = 'online';
        }

        // Get current activity
        let currentActivity = '';
        let currentEmoji = '';

        if (client.user.presence && client.user.presence.activities) {
            const custom = client.user.presence.activities.find(a => a.type === 'CUSTOM' || a.id === 'custom');
            if (custom) {
                currentActivity = custom.state || '';
                currentEmoji = custom.emoji ? (custom.emoji.id ? `<${custom.emoji.animated ? 'a' : ''}:${custom.emoji.name}:${custom.emoji.id}>` : custom.emoji.name) : '';
            }
        }

        res.render('index', {
            user: client.user,
            uptimeSeconds,
            status: status,
            currentActivity,
            currentEmoji,
            page: 'home'
        });
    });

    app.post('/update-status', async (req, res) => {
        try {
            const { status, custom_status, emoji } = req.body;

            let activities = [];
            if (custom_status) {
                activities.push({
                    type: 'CUSTOM',
                    name: 'Custom Status',
                    state: custom_status,
                    emoji: emoji || null
                });
            }

            await client.user.setPresence({
                status: status,
                activities: activities
            });

            res.redirect('/');
        } catch (error) {
            console.error(error);
            res.redirect('/?error=' + encodeURIComponent(error.message));
        }
    });

    // --- API & Routes ---

    // Live Logs Endpoint
    app.get('/api/logs', (req, res) => {
        const logPath = path.join(__dirname, '..', 'data', 'afklog.json');
        if (fs.existsSync(logPath)) {
            const logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
            res.json(logs);
        } else {
            res.json([]);
        }
    });

    // --- QUEST ROUTES ---

    app.get('/quest', (req, res) => {
        if (!client.user) return res.send('Bot loading...');
        res.render('quest', {
            user: client.user,
            page: 'quest'
        });
    });

    app.post('/quest/start-all', (req, res) => {
        questManager.startAll(); // Async background
        res.json({ success: true, message: 'Starting process...' });
    });

    app.post('/quest/stop-all', (req, res) => {
        questManager.stopAll();
        res.json({ success: true, message: 'All quests stopped.' });
    });

    app.post('/quest/clear-logs', (req, res) => {
        if (questManager.clearLogs) questManager.clearLogs();
        res.json({ success: true });
    });

    app.get('/api/quests', (req, res) => {
        res.json({
            // active: ... (optional, if we want visuals later)
            logs: questManager.globalLogs,
            isRunning: questManager.isRunning
        });
    });

    // --- AFK Routes ---

    app.get('/afk', (req, res) => {
        if (!client.user) return res.send('Bot loading...');

        const afkPath = path.join(__dirname, '..', 'data', 'afk.json');
        const logPath = path.join(__dirname, '..', 'data', 'afklog.json');

        let afkData = { isOn: false, reason: '' };
        let logs = [];

        if (fs.existsSync(afkPath)) afkData = JSON.parse(fs.readFileSync(afkPath, 'utf8'));
        if (fs.existsSync(logPath)) logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));

        res.render('afk', {
            user: client.user,
            afkData,
            logs,
            page: 'afk'
        });
    });

    app.post('/afk/save', (req, res) => {
        let { isOn, reason, logsEnabled } = req.body;
        const afkPath = path.join(__dirname, '..', 'data', 'afk.json');

        const checkBoolean = (val) => {
            if (Array.isArray(val)) return val.includes('on');
            return val === 'on';
        };

        const isAfkOn = checkBoolean(isOn);
        const isLogsOn = checkBoolean(logsEnabled);

        let existingData = {};
        if (fs.existsSync(afkPath)) existingData = JSON.parse(fs.readFileSync(afkPath, 'utf8'));

        const newData = {
            ...existingData,
            isOn: isAfkOn,
            reason: reason || existingData.reason || 'I am currently AFK.',
            logsEnabled: isLogsOn
        };

        fs.writeFileSync(afkPath, JSON.stringify(newData, null, 2));

        if (req.xhr || req.headers.accept && req.headers.accept.indexOf('json') > -1) {
            return res.json({ success: true, message: 'Settings saved!' });
        }

        res.redirect('/afk');
    });

    app.post('/afk/clear-logs', (req, res) => {
        const { logId, clearAll } = req.body;
        const logPath = path.join(__dirname, '..', 'data', 'afklog.json');

        if (clearAll) {
            fs.writeFileSync(logPath, JSON.stringify([], null, 2));
        } else if (logId) {
            let logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
            logs = logs.filter(l => l.id !== logId);
            fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
        }

        res.redirect('/afk');
    });

    // --- MUSIC Routes ---

    app.get('/music', (req, res) => {
        if (!client.user) return res.send('Bot loading...');
        res.render('music', {
            user: client.user,
            page: 'music'
        });
    });

    app.get('/api/music/status', (req, res) => {
        const queues = client.queueManager ? client.queueManager.getAll() : new Map();

        let musicData = {
            connected: !!client.lavalink,
            isPlaying: false,
            guildName: 'No Guild',
            guildIcon: null,
            channelName: '',
            nowPlaying: null,
            position: 0,
            duration: 0,
            queue: [],
            queueCount: 0
        };

        // Get first active queue
        for (const [guildId, queue] of queues) {
            if (queue.nowPlaying) {
                const guild = client.guilds.cache.get(guildId);
                const voiceState = client.voiceStates ? client.voiceStates[guildId] : null; // Custom voiceStates storage
                // OR check client.guilds.cache.get(guildId).me.voice.channel

                musicData.isPlaying = true;
                musicData.guildName = guild ? guild.name : `Guild ${guildId}`;
                musicData.guildIcon = guild ? guild.iconURL({ dynamic: true, size: 128 }) : null;

                // Try to find channel name
                // queue doesn't store channelId? Lavalink might. 
                // We'll leave channelName generic or try to find where bot is
                if (guild && guild.me && guild.me.voice && guild.me.voice.channel) {
                    musicData.channelName = guild.me.voice.channel.name;
                }

                const info = queue.nowPlaying.info;
                let cover = 'https://i.imgur.com/2ce2t5e.png'; // Fallback

                if (info.sourceName === 'youtube' || info.uri.includes('youtube')) {
                    cover = `https://img.youtube.com/vi/${info.identifier}/maxresdefault.jpg`;
                } else if (info.artworkUrl) {
                    cover = info.artworkUrl;
                }

                musicData.nowPlaying = {
                    title: info.title,
                    author: info.author,
                    cover: cover,
                    url: info.uri
                };

                musicData.duration = info.length;
                musicData.position = queue.position || 0;

                // Adjust position estimate
                if (queue.lastUpdate && !queue.paused) {
                    const diff = Date.now() - queue.lastUpdate;
                    musicData.position += diff;
                    if (musicData.position > musicData.duration) musicData.position = musicData.duration;
                }

                musicData.queue = queue.songs.map(song => ({
                    title: song.info.title,
                    author: song.info.author,
                    uri: song.info.uri
                }));
                musicData.queueCount = queue.songs.length;
                break;
            }
        }

        res.json(musicData);
    });

    app.post('/api/music/stop', async (req, res) => {
        try {
            const queues = client.queueManager ? client.queueManager.getAll() : new Map();
            let stopped = false;

            for (const [guildId, queue] of queues) {
                if (queue.nowPlaying) {
                    if (client.lavalink) {
                        await client.lavalink.destroyPlayer(guildId);
                    }
                    client.queueManager.delete(guildId);

                    // Try to disconnect from voice
                    const { getVoiceConnection } = require('@discordjs/voice');
                    const connection = getVoiceConnection(guildId);
                    if (connection) {
                        connection.destroy();
                    }

                    stopped = true;
                }
            }

            if (stopped) {
                res.json({ success: true, message: 'Music stopped' });
            } else {
                res.json({ success: false, message: 'No music is playing' });
            }
        } catch (error) {
            console.error('Error stopping music:', error);
            res.json({ success: false, message: error.message });
        }
    });

    app.listen(port, () => {
        console.log(`Dashboard is running on http://localhost:${port}`);
    });
};
