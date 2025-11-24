import mediapipe as mp
import cv2
import numpy as np

class PoseDetector:
    def __init__(self, smoothing_window=5):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.mp_drawing = mp.solutions.drawing_utils
        self.angle_history = []
        self.smoothing_window = smoothing_window

    def detect(self, frame):
        """
        Processes the frame and returns landmarks and the processed image.
        """
        # Convert BGR to RGB
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(image_rgb)
        
        # Draw landmarks on the frame (for visualization)
        if results.pose_landmarks:
            self.mp_drawing.draw_landmarks(
                frame,
                results.pose_landmarks,
                self.mp_pose.POSE_CONNECTIONS
            )
            
        return results.pose_landmarks, frame

    def calculate_angle(self, landmarks):
        """
        Calculates the angle of the ear-shoulder vector relative to the vertical axis.
        Returns the angle in degrees.
        """
        if not landmarks:
            return None

        # Get coordinates for left ear (7) and left shoulder (11)
        # We can also use right side (8, 12) or average them. 
        # For simplicity, let's use the side that is more visible or just Left for MVP.
        # Let's use Left side: Ear(7), Shoulder(11)
        l_ear = landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_EAR]
        l_shoulder = landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_SHOULDER]
        
        # Check visibility
        if l_ear.visibility < 0.5 or l_shoulder.visibility < 0.5:
            return None

        # Vector: Shoulder -> Ear (Upwards is expected)
        # Y axis increases downwards in image coordinates.
        dy = l_ear.y - l_shoulder.y
        dx = l_ear.x - l_shoulder.x
        
        # Calculate angle with respect to vertical (negative Y axis)
        # Vertical vector is (0, -1)
        # Angle = atan2(dx, -dy) * (180 / PI)
        # Note: -dy because we want the vector pointing UP from shoulder to ear.
        # But in image coords, Up is negative Y. So (shoulder.y - ear.y) is positive distance.
        
        # Let's simplify: Just get the absolute angle of the vector from vertical.
        angle_rad = np.arctan2(dx, -dy) # -dy to flip Y axis for standard math
        angle_deg = np.degrees(angle_rad)
        
        return abs(angle_deg)

    def get_smoothed_angle(self, current_angle):
        """
        Returns the moving average of the angle.
        """
        if current_angle is None:
            return None
            
        self.angle_history.append(current_angle)
        if len(self.angle_history) > self.smoothing_window:
            self.angle_history.pop(0)
            
        return np.mean(self.angle_history)

    def is_bad_posture(self, current_angle, base_angle, threshold=15):
        """
        Determines if the posture is bad based on the threshold.
        """
        if current_angle is None or base_angle is None:
            return False
            
        # If the angle deviates more than threshold from the baseline
        return abs(current_angle - base_angle) > threshold
