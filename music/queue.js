class Queue {
    constructor() {
        this.queues = new Map();
    }

    get(guildId) {
        return this.queues.get(guildId);
    }

    create(guildId) {
        const queue = {
            songs: [],
            history: [],
            nowPlaying: null,
            volume: 500,
            filters: {},
            textChannel: null,
        };
        this.queues.set(guildId, queue);
        return queue;
    }

    delete(guildId) {
        this.queues.delete(guildId);
    }

    addSong(guildId, song) {
        const queue = this.get(guildId);
        if (queue) {
            queue.songs.push(song);
        }
    }

    getNext(guildId) {
        const queue = this.get(guildId);
        if (queue && queue.songs.length > 0) {
            return queue.songs.shift();
        }
        return null;
    }

    clear(guildId) {
        const queue = this.get(guildId);
        if (queue) {
            queue.songs = [];
        }
    }

    getAll() {
        return this.queues;
    }
}

module.exports = new Queue();
