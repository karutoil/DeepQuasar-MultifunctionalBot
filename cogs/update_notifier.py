import discord
from discord.ext import commands, tasks
import asyncio

# Configuration options
UPDATE_NOTIFIER_CONFIG = {
    "enabled": True,
    "owner_id_override": None,  # Discord user ID to notify instead of app owner, or None
    "github_api_token": None,   # Optional GitHub token for higher rate limits
}

class UpdateNotifier(commands.Cog):
    """Checks for Docker image updates and notifies the owner."""

    def __init__(self, bot):
        self.bot = bot
        if UPDATE_NOTIFIER_CONFIG.get("enabled", True):
            self.update_check_loop.start()
        else:
            print("[UpdateNotifier] Update notifications are disabled in config.")

    def cog_unload(self):
        self.update_check_loop.cancel()

    @commands.Cog.listener()
    async def on_ready(self):
        # Run once at startup
        await self.check_for_updates()

    @tasks.loop(hours=24)
    async def update_check_loop(self):
        await self.check_for_updates()

    async def check_for_updates(self):
        """Main update check logic."""
        try:
            current_digest = await self.get_current_digest()
            latest_digest = await self.get_latest_digest()

            if not current_digest or not latest_digest:
                print("[UpdateNotifier] Skipping update check due to missing digest(s).")
                return

            if current_digest != latest_digest:
                commit_summary, commits_behind = await self.get_commit_summary(current_digest, latest_digest)
                await self.notify_owner(commits_behind, commit_summary)
            else:
                print("[UpdateNotifier] Bot is up to date with the latest Docker image.")
        except Exception as e:
            print(f"[UpdateNotifier] Error during update check: {e}")

    async def get_current_digest(self):
        """
        Retrieve the digest of the currently running Docker image.
        Recommended: set an environment variable DOCKER_IMAGE_DIGEST during build/deployment.
        """
        import os
        digest = os.getenv("DOCKER_IMAGE_DIGEST")
        if not digest:
            print("[UpdateNotifier] Environment variable DOCKER_IMAGE_DIGEST not set.")
            return None
        return digest

    async def get_latest_digest(self):
        """
        Fetch the latest image digest from Docker Hub.
        """
        import aiohttp

        repo = "karutoil/deepquasar-multifunctionalbot"
        tag = "latest"

        url = f"https://registry.hub.docker.com/v2/repositories/{repo}/tags/{tag}"

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as resp:
                    if resp.status != 200:
                        print(f"[UpdateNotifier] Failed to fetch Docker Hub tag info: {resp.status}")
                        return None
                    data = await resp.json()
                    # Extract digest from images list
                    images = data.get("images", [])
                    if not images:
                        print("[UpdateNotifier] No images found for tag.")
                        return None
                    digest = images[0].get("digest")
                    if not digest:
                        print("[UpdateNotifier] Digest not found in tag info.")
                        return None
                    return digest
        except Exception as e:
            print(f"[UpdateNotifier] Error fetching latest digest: {e}")
            return None

    async def get_commit_summary(self, current_digest, latest_digest):
        """
        Fetch commit summaries between current and latest digest SHAs.

        NOTE: This requires embedding the commit SHA in the image during build,
        and mapping digest -> commit SHA.

        Placeholder implementation for now.
        """
        # TODO: Implement actual GitHub API call using commit SHAs
        summary = "Latest commits:\n- Commit A: Fix bug\n- Commit B: Add feature\n"
        commits_behind = 2
        return summary, commits_behind

    async def notify_owner(self, commits_behind, commit_summary):
        """
        Send a DM to the bot owner with update info.
        """
        try:
            app_info = await self.bot.application_info()

            # Use override owner ID if set
            override_id = UPDATE_NOTIFIER_CONFIG.get("owner_id_override")
            if override_id:
                owner = await self.bot.fetch_user(override_id)
            else:
                owner = app_info.owner

            if owner is None:
                print("[UpdateNotifier] Bot owner not found.")
                return

            update_command = self.get_update_command()

            message = (
                f"🔔 **Update Available!**\n"
                f"You are **{commits_behind}** commits behind the latest Docker image.\n\n"
                f"{commit_summary}\n"
                f"**To update your bot, run:**\n"
                f"```bash\n{update_command}\n```"
            )
            await owner.send(message)
        except Exception as e:
            print(f"[UpdateNotifier] Failed to notify owner: {e}")

    def get_update_command(self):
        """
        Return the recommended Docker update command string.
        Default: Linux/macOS.
        """
        # TODO: Detect or configure OS to customize this
        return "docker pull karutoil/deepquasar-multifunctionalbot:latest && docker-compose down && docker-compose up -d"

async def setup(bot):
    await bot.add_cog(UpdateNotifier(bot))
