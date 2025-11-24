FROM python:3.10-slim

# Prevent Python from writing pyc files and buffering stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies required for OpenCV and MediaPipe
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    pkg-config \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libswscale-dev \
    libavdevice-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

# Expose Streamlit port
EXPOSE 8501

# Healthcheck to ensure Streamlit is running
HEALTHCHECK CMD curl --fail http://localhost:8501/_stcore/health || exit 1

# Run the application
CMD ["streamlit", "run", "src/main.py", "--server.address=0.0.0.0"]
