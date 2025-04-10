# Use the official Python image
FROM python:3.11-slim

# Set environment variables
ARG COMMIT_SHA=unknown
ENV GIT_COMMIT_SHA=$COMMIT_SHA
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies including ffmpeg for music features
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy project files
COPY . /app/

# Expose any ports if necessary (Discord bots usually don't need this)
# EXPOSE 800

# Command to run the bot
CMD ["python", "main.py"]
