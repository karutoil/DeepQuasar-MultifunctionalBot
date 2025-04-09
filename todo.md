# TODO: Automated Docker Image Update Checker & Notifier

Implement a feature in the bot that **checks for new Docker image updates** and **notifies the bot owner** with version lag and changelog details.

---

## Overview

- **Check frequency:**  
  - [x] **Once daily** (scheduled task)  
  - [x] **AND once at bot startup**

- **Detection method:**  
  - [x] Use **Docker image digests** to detect if a newer image is available on Docker Hub.
  - [x] Compare the **current running container's image digest** with the **latest digest** from Docker Hub.

- **Changelog source:**  
  - [x] Use the **GitHub API** to fetch commit summaries **between the current image's commit** and the **latest commit** associated with the new image. (placeholder implemented)

- **Notification:**  
  - [x] Send a **direct message (DM)** to the bot owner with:
    - [x] How many versions (commits) behind the current image is
    - [x] A summary of the latest commits (commit messages, authors, dates)
    - [x] Optionally, provide the user with the **appropriate Docker update command** for their main OS to pull and restart the updated image, e.g.:

        - For **Linux/macOS**:

          ```
          docker pull karutoil/deepquasar-multifunctionalbot:latest && docker-compose down && docker-compose up -d
          ```

        - For **Windows (PowerShell)**:

          ```
          docker pull karutoil/deepquasar-multifunctionalbot:latest; docker-compose down; docker-compose up -d
          ```

        - (Detect or configure the OS to customize the message)

---

## Implementation Checklist

- [ ] **Identify current image digest**
  - [x] **Create a script or build step to fetch the latest digest from Docker Hub and store it as an environment variable (`DOCKER_IMAGE_DIGEST`) during build or deployment.**  
        This ensures the running container knows which digest it was built from.
  - [x] **Store the current image digest or commit SHA as an environment variable or label during build/deployment.**  
        This is critical because the `latest` tag moves, but the digest is immutable per image build.
  - [x] Retrieve the digest from the `DOCKER_IMAGE_DIGEST` environment variable at runtime.
  - [ ] Alternatively, retrieve from a Docker label if preferred. (optional, not implemented)
  - [x] Embed commit SHA in image during build for changelog comparison

- [x] **Fetch latest image digest**
  - [x] Query Docker Hub API for latest digest/tag
  - [x] Compare with current digest

- [x] **If update available:**
  - [x] Use GitHub API to get commits between current and latest commit SHAs (placeholder implemented)
  - [x] Count number of commits behind (placeholder implemented)
  - [x] Collect commit summaries (message, author, date) (placeholder implemented)

- [x] **Send DM to owner (Discord bot application owner):**
  - [x] Compose message with:
    - [x] Number of versions behind
    - [x] Recent commit summaries
    - [x] Update command instructions

- [x] **Schedule the check:**
  - [x] Run **once at bot startup**
  - [x] Run **once every 24 hours** using `discord.ext.tasks.loop`

- [x] **Add config options:**
  - [x] Enable/disable update notifications
  - [x] Owner ID override (if needed)
  - [x] GitHub API token (optional, for higher rate limits)

---

## Notes

- Using **Docker image digests** is a reliable way to detect updates regardless of tags.
- Embedding the **commit SHA** in the image (via build args or labels) is essential for accurate changelog generation.
- This feature improves maintainability by proactively informing the owner about updates and changes.

---

## References

- [Docker Hub API](https://docs.docker.com/docker-hub/api/latest/)
- [GitHub REST API](https://docs.github.com/en/rest/commits/commits)
- [discord.py tasks](https://discordpy.readthedocs.io/en/stable/ext/tasks/index.html)
