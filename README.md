# RoadVision 🚗🔍

**RoadVision** is an AI-powered web application designed to detect and recognize license plates from images. It can identify speeding violations by comparing timestamps from multiple camera points and stores all data with visual proof for verification.

---

## 🔧 Features

- 🎯 **License Plate Detection** – YOLO-based model for accurate localization.  
- 🧠 **OCR Integration** – Extracts plate number, state, and expiry using EasyOCR or Tesseract.  
- 📸 **Image Upload Interface** – Upload single or multiple images directly in-browser.  
- 🚀 **Speeding Detection** – Calculates speed based on timestamp and distance between two fixed cameras.  
- 🗃️ **SQL Database** – Stores plate data, timestamps, locations, and images.  
- 📊 **Data Visualization** – View all detections and violations in a web interface.  
- 📁 **CSV Export** – Download violations with proof for records or sharing.  
- 🌐 **Responsive UI** – Built with a custom HTML/CSS/JS frontend.  

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)  
- **Backend**: Python (Flask)  
- **AI/ML**: YOLOv5 (for detection), EasyOCR / Tesseract (for OCR)  
- **Database**: SQLite / MySQL

---

## 🚀 Getting Started (Local Setup)

### 1. Clone the Repository

```bash
git clone https://github.com/idevanshrai/RoadVision.git
cd RoadVision
````

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the Flask App

```bash
python app.py
```

### 4. Open in Your Browser

Visit [http://localhost:5000](http://localhost:5000) to access the app.

---

## 📁 Project Structure

```
RoadVision/
├── static/
│   ├── css/
│   ├── js/
│   └── assets/
├── templates/
│   └── index.html
├── uploads/
├── app.py
├── requirements.txt
└── README.md
```

---

## 📷 Use Cases

* Traffic monitoring systems
* Toll plaza automation
* Parking lot management
* Highway speeding detection

---

## 🗺️ To-Do (Upcoming Features)

* [ ] Real-time camera stream support
* [ ] Admin login & user management
* [ ] Public dashboard with analytics
* [ ] Multi-language OCR support
* [ ] Deploy full backend to Railway/Render

---

## 🙌 Acknowledgments

* Built by [Devansh Rai](https://github.com/idevanshrai)
* YOLOv5 model by Ultralytics
* OCR via EasyOCR and Tesseract

---

## 📜 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.
