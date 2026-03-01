module.exports = {
    name: 'filter',
    description: 'Toggle audio filter',
    async execute(message, args, client) {
        if (!message.guild) {
            await message.channel.send('```This command only works in servers```');
            return;
        }

        const queue = client.queueManager.get(message.guild.id);

        if (!queue || !queue.nowPlaying) {
            await message.channel.send('```No music is playing```');
            return;
        }

        const filterName = args[0]?.toLowerCase();
        const allowed = ['bassboost', 'nightcore', 'vaporwave'];

        if (!allowed.includes(filterName)) {
            await message.channel.send(`\`\`\`\nAvailable Filters: ${allowed.join(', ')}\n\`\`\``);
            return;
        }

        try {
            if (!queue.filters) queue.filters = {};

            // toggle
            queue.filters[filterName] = !queue.filters[filterName];

            await client.lavalink.updatePlayer(
                message.guild.id,
                queue.nowPlaying,
                client.voiceStates[message.guild.id],
                { volume: queue.volume, filters: queue.filters }
            );

            let response = '```\n';
            response += '╭─[ FILTER UPDATED ]─╮\n\n';
            response += `  🎛 ${filterName} → ${queue.filters[filterName] ? 'Enabled' : 'Disabled'}\n`;
            response += '\n╰──────────────────────────────╯\n```';

            await message.channel.send(response);

        } catch (err) {
            console.error('[Filter Error]:', err);
            await message.channel.send(`\`\`\`js\n❌ Error: ${err.message}\n\`\`\``);
        }
    },
};
