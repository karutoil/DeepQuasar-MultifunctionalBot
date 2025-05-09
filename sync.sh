#!/bin/bash
# filepath: /workspaces/DeepQuasar-MultifunctionalBot/sync.sh

# Check for the --help flag
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Usage: ./sync.sh [options]"
    echo ""
    echo "Options:"
    echo "  --global      Sync global commands (all servers)"
    echo "  --guild       Sync guild commands (specific server, uses GUILD_ID from .env)"
    echo "  --wipe-only   Only wipe commands, don't register new ones"
    echo "  --list        Only list current commands, don't make any changes"
    echo "  --help, -h    Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./sync.sh --guild        # Wipe and sync commands for specific guild from .env"
    echo "  ./sync.sh --global       # Wipe and sync global commands"
    echo "  ./sync.sh --list --guild # List commands for specific guild"
    echo ""
    exit 0
fi

# Default to guild mode
MODE="--guild"

# Process command line arguments
for arg in "$@"; do
    if [[ "$arg" == "--global" ]]; then
        MODE="--global"
    fi
done

# Pass all arguments to the syncCommands.js script
echo "Executing: node syncCommands.js $@"
node syncCommands.js "$@"
