module.exports = {
    name: 'clearfilters',
    description: 'Clear all active filters',
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

        try {
            queue.filters = {};

            await client.lavalink.updatePlayer(
                message.guild.id,
                queue.nowPlaying,
                client.voiceStates[message.guild.id],
                { volume: queue.volume, filters: queue.filters }
            );

            let response = '```\n';
            response += '╭─[ FILTERS CLEARED ]─╮\n\n';
            response += '  🎛 All filters disabled\n';
            response += '\n╰──────────────────────────────╯\n```';

            await message.channel.send(response);

        } catch (err) {
            console.error('[ClearFilters Error]:', err);
            await message.channel.send(`\`\`\`js\n❌ Error: ${err.message}\n\`\`\``);
        }
    },
};
