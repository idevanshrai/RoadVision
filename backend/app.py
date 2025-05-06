from flask import Flask, request, jsonify, send_from_directory, send_file
from werkzeug.utils import secure_filename
import os
import cv2
import numpy as np
from datetime import datetime, timedelta
import pytz
from fuzzywuzzy import fuzz
import re
import json
from ultralytics import YOLO
import easyocr
from flask_cors import CORS
import matplotlib.pyplot as plt
from io import BytesIO
import exifread

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:*", "http://127.0.0.1:*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Initialize models
model_path = "models/license_plate_detector.pt"
model = YOLO(model_path)
reader = easyocr.Reader(['en'])

# Configuration
UPLOAD_FOLDER = 'uploads'
PLATE_FOLDER = 'plate_images'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
TIME_FORMAT = '%H:%M:%S'
DATE_FORMAT = '%d-%m-%Y'
TIMEZONE = 'America/New_York'
DB_FILE = "detections.json"

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PLATE_FOLDER'] = PLATE_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB limit

# Ensure upload directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PLATE_FOLDER, exist_ok=True)

# US states list for state detection
US_STATES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
    "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
    "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
    "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
    "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
    "Washington", "West Virginia", "Wisconsin", "Wyoming"
]


def get_image_timestamp(file_stream):
    """Extract timestamp from image EXIF data"""
    file_stream.seek(0)
    try:
        tags = exifread.process_file(file_stream)
        if 'EXIF DateTimeOriginal' in tags:
            dt = datetime.strptime(str(tags['EXIF DateTimeOriginal']), '%Y:%m:%d %H:%M:%S')
            return pytz.timezone(TIMEZONE).localize(dt)
    except Exception as e:
        print(f"Error reading EXIF data: {str(e)}")
    return None


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def preprocess_image(file_stream):
    """Improved image decoding with multiple attempts"""
    try:
        file_bytes = np.frombuffer(file_stream.read(), np.uint8)
        image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if image is None:
            file_stream.seek(0)
            file_bytes = np.frombuffer(file_stream.read(), np.uint8)
            image = cv2.imdecode(file_bytes, cv2.IMREAD_UNCHANGED)
            if image is not None and len(image.shape) == 3 and image.shape[2] == 4:
                image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
        if image is None:
            raise ValueError("Could not decode image")
        return image
    except Exception as e:
        raise ValueError(f"Image processing error: {str(e)}")


def validate_plate_format(plate_number):
    """More lenient plate validation"""
    if not plate_number:
        return False
    clean_plate = re.sub(r'[^A-Z0-9]', '', plate_number.upper())
    return len(clean_plate) >= 3


def parse_timestamp(date_str, time_str):
    try:
        date_obj = datetime.strptime(date_str, DATE_FORMAT).date()
        time_obj = datetime.strptime(time_str, TIME_FORMAT).time()
        dt = datetime.combine(date_obj, time_obj)
        return pytz.timezone(TIMEZONE).localize(dt)
    except ValueError as e:
        raise ValueError(f"Invalid timestamp format. Error: {str(e)}")


def calculate_speed(entry_ts, exit_ts, distance_ft):
    try:
        time_diff = (exit_ts - entry_ts).total_seconds() / 3600
        return (distance_ft / 5280) / time_diff
    except Exception as e:
        raise ValueError(f"Speed calculation error: {str(e)}")


def is_plate_match(plate1, plate2, threshold=85):
    if not plate1 or not plate2:
        return False
    clean_plate1 = re.sub(r'[^A-Z0-9]', '', plate1.upper())
    clean_plate2 = re.sub(r'[^A-Z0-9]', '', plate2.upper())
    return fuzz.ratio(clean_plate1, clean_plate2) >= threshold


def find_previous_detection(plate_number):
    detections = load_detections()
    for detection in reversed(detections):
        if is_plate_match(detection['plate'], plate_number):
            return detection
    return None


def load_detections():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []


def save_detection(detection):
    detections = load_detections()
    detections.append(detection)
    with open(DB_FILE, 'w') as f:
        json.dump(detections, f, indent=2, default=str)


def load_detections_for_charts():
    detections = load_detections()

    # Initialize with default values
    speed_data = {'0-20': 1, '21-40': 0, '41-60': 0, '61-80': 0, '81+': 0}
    hourly_averages = [{'hour': f"{h}:00", 'average_speed': 30} for h in range(24)]

    if detections:
        speed_data = {'0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81+': 0}
        time_data = {hour: {'total': 0, 'count': 0} for hour in range(24)}

        for detection in detections:
            speed = detection['speed']
            hour = datetime.fromisoformat(detection['timestamp']).hour

            if speed <= 20:
                speed_data['0-20'] += 1
            elif speed <= 40:
                speed_data['21-40'] += 1
            elif speed <= 60:
                speed_data['41-60'] += 1
            elif speed <= 80:
                speed_data['61-80'] += 1
            else:
                speed_data['81+'] += 1

            time_data[hour]['total'] += speed
            time_data[hour]['count'] += 1

        hourly_averages = []
        for hour in range(24):
            avg = time_data[hour]['total'] / time_data[hour]['count'] if time_data[hour]['count'] > 0 else 0
            hourly_averages.append({'hour': f"{hour}:00", 'average_speed': round(avg, 1)})

    return {
        'speed_distribution': speed_data,
        'hourly_averages': hourly_averages,
        'total_detections': len(detections) if detections else 1
    }


def generate_speed_analytics():
    """Generate speed analytics graph with fallback to dummy data"""
    detections = load_detections()

    if not detections:
        # Dummy data
        speeds = [30]
        timestamps = [datetime.now(pytz.timezone(TIMEZONE))]
    else:
        speeds = [d['speed'] for d in detections]
        timestamps = [datetime.fromisoformat(d['timestamp']) for d in detections]

    plt.figure(figsize=(10, 5))
    plt.plot(timestamps, speeds, 'o-', markersize=3, linewidth=1)
    plt.title('Speed Detection Analytics')
    plt.xlabel('Time')
    plt.ylabel('Speed (mph)')
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.tight_layout()

    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=100)
    buf.seek(0)
    plt.close()

    return buf


def enhance_plate_image(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 11, 17, 17)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh


def detect_plate_info(image, filename=None):
    try:
        results = model(image, conf=0.5)
        full_text = ""
        plate_image = None

        for result in results:
            for box in result.boxes.xyxy:
                x1, y1, x2, y2 = map(int, box)
                h, w = image.shape[:2]
                expand_x = int(0.1 * (x2 - x1))
                expand_y = int(0.1 * (y2 - y1))
                x1 = max(0, x1 - expand_x)
                y1 = max(0, y1 - expand_y)
                x2 = min(w, x2 + expand_x)
                y2 = min(h, y2 + expand_y)

                license_plate_crop = image[y1:y2, x1:x2]
                plate_image = license_plate_crop.copy()
                enhanced_plate = enhance_plate_image(license_plate_crop)

                ocr_result = reader.readtext(enhanced_plate, detail=0, paragraph=True,
                                             allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
                full_text += " ".join(ocr_result).strip() + "\n"

        cleaned_text = re.sub(r'[^A-Z0-9]', '', full_text.upper())
        plate_number = cleaned_text[:8] if cleaned_text else None

        detected_state = None
        for state in US_STATES:
            if state.upper() in full_text.upper():
                detected_state = state
                break

        if plate_image is not None:
            plate_filename = f"plate_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            plate_path = os.path.join(app.config['PLATE_FOLDER'], plate_filename)
            cv2.imwrite(plate_path, plate_image)

        return {
            "plate": plate_number,
            "state": detected_state,
            "raw_text": full_text.strip(),
            "plate_image": plate_filename if plate_image is not None else None
        }
    except Exception as e:
        print(f"Error in plate detection: {str(e)}")
        return None


@app.route('/')
def home():
    return """
    <h1>LuminPlate API</h1>
    <p>Available endpoints:</p>
    <ul>
        <li>POST /api/detect - Process license plate images</li>
        <li>GET /api/detections - Get detection history</li>
        <li>GET /api/analytics - Get speed analytics graph</li>
        <li>GET /api/plate_image/<filename> - Get processed plate image</li>
    </ul>
    """


@app.route('/api/detections', methods=['GET'])
def get_detections():
    try:
        detections = load_detections()
        # Sort detections by timestamp in descending order
        detections.sort(key=lambda x: datetime.fromisoformat(x['timestamp']), reverse=True)
        return jsonify(detections)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/detections/chart-data', methods=['GET'])
def get_chart_data():
    try:
        chart_data = load_detections_for_charts()
        return jsonify(chart_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    try:
        buf = generate_speed_analytics()
        return send_file(buf, mimetype='image/png')
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/plate_image/<filename>', methods=['GET'])
def get_plate_image(filename):
    try:
        return send_from_directory(app.config['PLATE_FOLDER'], filename)
    except FileNotFoundError:
        return jsonify({'error': 'Plate image not found'}), 404


@app.route('/api/detect', methods=['POST'])
def detect_plate():
    if 'fileA' not in request.files or 'fileB' not in request.files:
        return jsonify({'error': 'Missing image files'}), 400

    file_a = request.files['fileA']
    file_b = request.files['fileB']
    distance_ft = request.form.get('distance', '')
    speed_limit = request.form.get('speedLimit', '')

    if not all([file_a, file_b, distance_ft, speed_limit]):
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        distance_ft = float(distance_ft)
        speed_limit = float(speed_limit)
        if distance_ft <= 0:
            raise ValueError("Distance must be positive")
    except ValueError:
        return jsonify({'error': 'Invalid distance or speed limit value'}), 400

    if not (file_a.filename and file_b.filename):
        return jsonify({'error': 'No selected file'}), 400

    if not allowed_file(file_a.filename) or not allowed_file(file_b.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    try:
        # Get timestamps from image EXIF data
        file_a.stream.seek(0)
        entry_ts = get_image_timestamp(file_a) or (datetime.now(pytz.timezone(TIMEZONE)) - timedelta(minutes=1))

        file_b.stream.seek(0)
        exit_ts = get_image_timestamp(file_b) or datetime.now(pytz.timezone(TIMEZONE))

        # Process images
        try:
            file_a.stream.seek(0)
            image_a = preprocess_image(file_a)
        except Exception as e:
            return jsonify({'error': f'Failed to process File A: {str(e)}'}), 400

        try:
            file_b.stream.seek(0)
            image_b = preprocess_image(file_b)
        except Exception as e:
            return jsonify({'error': f'Failed to process File B: {str(e)}'}), 400

        # Detect plates
        plate_info_a = detect_plate_info(image_a, file_a.filename)
        plate_info_b = detect_plate_info(image_b, file_b.filename)

        if not plate_info_a or not plate_info_b:
            return jsonify({'error': 'Could not detect license plate in one or both images'}), 400

        plate_number_a = plate_info_a['plate']
        plate_number_b = plate_info_b['plate']

        if not validate_plate_format(plate_number_a) or not validate_plate_format(plate_number_b):
            return jsonify({
                'error': 'Plate format warning',
                'message': f'Detected plates: {plate_number_a} and {plate_number_b}',
                'plateA': plate_info_a,
                'plateB': plate_info_b,
                'plateImageA': f"/api/plate_image/{plate_info_a['plate_image']}" if plate_info_a[
                    'plate_image'] else None,
                'plateImageB': f"/api/plate_image/{plate_info_b['plate_image']}" if plate_info_b[
                    'plate_image'] else None
            }), 200

        if not is_plate_match(plate_number_a, plate_number_b):
            return jsonify({
                'error': 'Plate mismatch',
                'message': 'The license plates in the two images do not match',
                'plateA': plate_info_a,
                'plateB': plate_info_b,
                'plateImageA': f"/api/plate_image/{plate_info_a['plate_image']}" if plate_info_a[
                    'plate_image'] else None,
                'plateImageB': f"/api/plate_image/{plate_info_b['plate_image']}" if plate_info_b[
                    'plate_image'] else None
            }), 400

        # Check for duplicate detection with same timestamps
        for detection in load_detections():
            entry_diff = abs((datetime.fromisoformat(detection['entry_timestamp']) - entry_ts).total_seconds())
            exit_diff = abs((datetime.fromisoformat(detection['exit_timestamp']) - exit_ts).total_seconds())
            if (is_plate_match(detection['plate'], plate_number_a) and entry_diff < 60 and exit_diff < 60):
                return jsonify({
                    'error': 'Duplicate detection',
                    'message': 'This plate with similar timestamps has already been processed'
                }), 400

        # Calculate speed
        speed_mph = calculate_speed(entry_ts, exit_ts, distance_ft)

        # Check for previous detection of this plate
        prev_detection = find_previous_detection(plate_number_a)

        # Create detection record
        detection = {
            'plate': plate_number_a,
            'state': plate_info_a['state'],
            'entry_timestamp': entry_ts.isoformat(),
            'exit_timestamp': exit_ts.isoformat(),
            'distance': distance_ft,
            'speed': round(speed_mph, 1),
            'speedLimit': speed_limit,
            'timestamp': datetime.now(pytz.timezone(TIMEZONE)).isoformat(),
            'isOverSpeed': speed_mph > speed_limit,
            'previous_detection': prev_detection['timestamp'] if prev_detection else None,
            'plate_image': plate_info_a['plate_image']
        }

        save_detection(detection)

        return jsonify({
            'success': True,
            'detection': detection,
            'plate_image_url': f"/api/plate_image/{plate_info_a['plate_image']}" if plate_info_a[
                'plate_image'] else None,
            'warning': 'Previous detection exists for this plate' if prev_detection else None
        })

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Processing error: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)