import streamlit as antigravity
import cv2
import time
import numpy as np
import av
from streamlit_webrtc import webrtc_streamer, VideoTransformerBase
from pose_detector import PoseDetector

# Page Config
antigravity.set_page_config(
    page_title="PostureGuard",
    page_icon="🧘",
    layout="wide"
)

# Initialize Session State for UI controls (Thresholds)
if 'threshold' not in antigravity.session_state:
    antigravity.session_state.threshold = 15
if 'smoothing' not in antigravity.session_state:
    antigravity.session_state.smoothing = 5

class VideoProcessor(VideoTransformerBase):
    def __init__(self):
        self.detector = None
        self.base_angle = None
        self.start_time = None
        self.bad_posture_start_time = None
        self.calibration_duration = 3.0
        
        # We need to read these from a shared source or pass them in.
        # For simplicity, we'll read defaults, but ideally we'd use a thread-safe way to get slider values.
        # Since we can't easily access st.session_state inside the thread, we will use class attributes
        # that are updated via the main thread if possible, or just read global/default for MVP.
        self.threshold = 15
        self.smoothing = 5

    def recv(self, frame):
        img = frame.to_ndarray(format="bgr24")
        
        # Initialize detector lazily to ensure it's in the right thread/process context if needed
        if self.detector is None:
            self.detector = PoseDetector(smoothing_window=self.smoothing)
            self.start_time = time.time()

        # Detect
        landmarks, processed_frame = self.detector.detect(img)
        
        # Calculate Angle
        raw_angle = self.detector.calculate_angle(landmarks)
        smoothed_angle = self.detector.get_smoothed_angle(raw_angle)
        
        current_time = time.time()
        elapsed = current_time - self.start_time
        
        # Overlay Info Box
        h, w, _ = processed_frame.shape
        cv2.rectangle(processed_frame, (0, 0), (w, 80), (0, 0, 0), -1) # Top banner
        
        # Calibration Phase
        if elapsed < self.calibration_duration:
            status = "CALIBRATING..."
            color = (0, 255, 255) # Yellow
            
            if smoothed_angle is not None:
                self.base_angle = smoothed_angle
                
            cv2.putText(processed_frame, f"{status} {int(self.calibration_duration - elapsed)}s", (20, 50), 
                       cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
            
            if smoothed_angle is not None:
                cv2.putText(processed_frame, f"Angle: {smoothed_angle:.1f}", (w - 250, 50),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

        # Monitoring Phase
        else:
            if self.base_angle is None:
                cv2.putText(processed_frame, "Calibration Failed. Restart.", (20, 50), 
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            else:
                is_bad = self.detector.is_bad_posture(smoothed_angle, self.base_angle, self.threshold)
                
                if is_bad:
                    if self.bad_posture_start_time is None:
                        self.bad_posture_start_time = current_time
                    
                    bad_duration = current_time - self.bad_posture_start_time
                    if bad_duration > 3.0:
                        status = "BAD POSTURE!"
                        color = (0, 0, 255) # Red
                    else:
                        status = f"WARNING ({bad_duration:.1f}s)"
                        color = (0, 165, 255) # Orange
                else:
                    self.bad_posture_start_time = None
                    status = "GOOD POSTURE"
                    color = (0, 255, 0) # Green

                # Draw Status
                cv2.putText(processed_frame, status, (20, 50), 
                           cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
                
                # Draw Metrics
                if smoothed_angle is not None:
                    info = f"Cur: {smoothed_angle:.1f} | Base: {self.base_angle:.1f}"
                    cv2.putText(processed_frame, info, (w - 400, 50),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        return av.VideoFrame.from_ndarray(processed_frame, format="bgr24")

def main():
    # Sidebar
    antigravity.sidebar.title("⚙️ Settings")
    
    # Note: Updating these sliders won't dynamically change the running WebRTC processor in this simple MVP 
    # because the processor is instantiated once. To make it dynamic requires a bit more glue code.
    # For MVP, we instruct user to set these BEFORE starting.
    threshold = antigravity.sidebar.slider("Threshold (degrees)", 5, 30, 15)
    smoothing = antigravity.sidebar.slider("Smoothing Window", 1, 10, 5)
    
    antigravity.sidebar.info("Note: Restart camera to apply new settings.")

    # Main UI
    antigravity.title("🧘 PostureGuard")
    antigravity.markdown("**Powered by `antigravity` (Streamlit) & WebRTC**")
    antigravity.markdown("Runs entirely in your browser! No Docker device mounting required.")

    col1, col2 = antigravity.columns([3, 1])
    
    with col2:
        antigravity.subheader("Instructions")
        antigravity.markdown("""
        1. Allow Camera Access.
        2. Click **Start**.
        3. **Sit straight** for the first 3 seconds (Calibration).
        4. If you slouch > 3 seconds, you get an alert.
        """)

    with col1:
        # WebRTC Streamer
        ctx = webrtc_streamer(
            key="posture-guard",
            video_processor_factory=VideoProcessor,
            rtc_configuration={"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]},
            media_stream_constraints={"video": True, "audio": False},
            async_processing=True,
        )
        
        # Inject settings into processor if it exists
        if ctx.video_processor:
            ctx.video_processor.threshold = threshold
            ctx.video_processor.smoothing = smoothing

if __name__ == "__main__":
    main()
