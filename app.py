import os
import pickle
import cv2
import mediapipe as mp
import numpy as np
from flask import Flask, render_template, Response, jsonify, request
import base64
import io
from PIL import Image
import json
import time
import threading
from collections import deque
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Chargement du modèle
try:
    model_dict = pickle.load(open('./model_sign_language.p', 'rb'))
    model = model_dict['model']
    print("✅ Modèle chargé avec succès!")
except Exception as e:
    print(f"❌ Erreur lors du chargement du modèle: {e}")
    model = None

# Initialisation Mediapipe avec optimisation
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
    model_complexity=0  # 0 = plus léger, plus rapide
)

# Dictionnaire pour convertir l'index prédit en lettre
labels_dict = {
    0: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e', 5: 'f', 6: 'g', 7: 'h',
    8: 'i', 9: 'j', 10: 'k', 11: 'l', 12: 'm', 13: 'n', 14: 'o', 15: 'p',
    16: 'q', 17: 'r', 18: 's', 19: 't', 20: 'u', 21: 'v', 22: 'w', 23: 'x', 24: 'y', 25: 'z'
}

# Variables globales avec verrous pour la sécurité des threads
current_text = ""
translation_history = []
detection_buffer = {}  # {lettre: {"start_time": timestamp, "count": nb_detections}}
lock = threading.Lock()

# Configuration par défaut
user_config = {
    'confirmation_delay': 2,  # secondes par défaut
    'sound_enabled': False,
    'skeleton_enabled': False
}

def process_frame_fast(frame_rgb):
    """Version optimisée du traitement d'image"""
    if model is None:
        return None
    
    # Redimensionner pour accélérer le traitement
    frame_small = cv2.resize(frame_rgb, (320, 240))
    
    data_aux = []
    x_ = []
    y_ = []
    
    # Mediapipe sur image réduite
    results = hands.process(frame_small)
    
    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            # Extraction rapide des landmarks
            h, w, _ = frame_small.shape
            for i in range(21):  # 21 landmarks par main
                x = hand_landmarks.landmark[i].x
                y = hand_landmarks.landmark[i].y
                x_.append(x)
                y_.append(y)
            
            # Normalisation directe (pas de min/max pour éviter calculs supplémentaires)
            for i in range(21):
                x = hand_landmarks.landmark[i].x
                y = hand_landmarks.landmark[i].y
                data_aux.append(x - min(x_) if x_ else 0)
                data_aux.append(y - min(y_) if y_ else 0)
            
            break  # Une seule main
    
    if len(data_aux) == 42:  # 21 landmarks * 2 coordonnées
        try:
            # Prédiction rapide
            prediction = model.predict([np.asarray(data_aux)])
            return labels_dict.get(int(prediction[0]), '?')
        except Exception as e:
            print(f"Erreur prédiction: {e}")
            return None
    
    return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process_frame', methods=['POST'])
def process_frame():
    """Endpoint optimisé pour traiter les frames"""
    global current_text, detection_buffer
    
    try:
        data = request.get_json()
        image_data = data['image'].split(',')[1]
        image_bytes = base64.b64decode(image_data)
        
        # Conversion rapide
        image = Image.open(io.BytesIO(image_bytes))
        frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Prédiction
        predicted_char = process_frame_fast(frame_rgb)
        
        current_time = time.time()
        response_data = {
            'success': True,
            'predicted_char': predicted_char,
            'current_text': current_text,
            'confirmed_char': None,
            'detection_active': False
        }
        
        with lock:
            # Gestion intelligente de la détection
            if predicted_char:
                # Lissage temporel
                if predicted_char in detection_buffer:
                    detection_buffer[predicted_char]['count'] += 1
                    
                    # Calcul du temps écoulé
                    elapsed = current_time - detection_buffer[predicted_char]['start_time']
                    
                    # Confirmation si seuil atteint ET assez de détections consécutives
                    if elapsed >= user_config['confirmation_delay'] and detection_buffer[predicted_char]['count'] > 3:
                        current_text += predicted_char
                        translation_history.append(predicted_char)
                        
                        response_data['confirmed_char'] = predicted_char
                        response_data['current_text'] = current_text
                        
                        # Réinitialiser pour cette lettre
                        del detection_buffer[predicted_char]
                    else:
                        response_data['detection_active'] = True
                        response_data['time_remaining'] = max(0, user_config['confirmation_delay'] - elapsed)
                        response_data['detection_char'] = predicted_char
                else:
                    # Nouvelle détection
                    detection_buffer[predicted_char] = {
                        'start_time': current_time,
                        'count': 1
                    }
                    response_data['detection_active'] = True
                    response_data['time_remaining'] = user_config['confirmation_delay']
                    response_data['detection_char'] = predicted_char
            else:
                # Nettoyer les détections trop anciennes
                current_time = time.time()
                to_delete = []
                for char, data in detection_buffer.items():
                    if current_time - data['start_time'] > user_config['confirmation_delay'] + 1:
                        to_delete.append(char)
                for char in to_delete:
                    del detection_buffer[char]
        
        return jsonify(response_data)
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/update_text', methods=['POST'])
def update_text():
    """Gestion des actions sur le texte"""
    global current_text, translation_history, detection_buffer
    
    data = request.get_json()
    action = data.get('action')
    
    with lock:
        # Vider le buffer de détection
        detection_buffer.clear()
        
        if action == 'clear':
            current_text = ""
            translation_history = []
        elif action == 'space':
            current_text += " "
            translation_history.append(" ")
        elif action == 'backspace':
            if current_text:
                current_text = current_text[:-1]
                if translation_history:
                    translation_history.pop()
        elif action == 'enter':
            current_text += "\n"
            translation_history.append("\n")
    
    return jsonify({
        'success': True,
        'current_text': current_text,
        'history': translation_history[-10:]
    })

@app.route('/update_config', methods=['POST'])
def update_config():
    """Mettre à jour la configuration utilisateur"""
    global user_config
    
    data = request.get_json()
    if 'confirmation_delay' in data:
        delay = int(data['confirmation_delay'])
        if 1 <= delay <= 5:
            user_config['confirmation_delay'] = delay
    
    if 'sound_enabled' in data:
        user_config['sound_enabled'] = data['sound_enabled']
    
    if 'skeleton_enabled' in data:
        user_config['skeleton_enabled'] = data['skeleton_enabled']
    
    return jsonify({'success': True, 'config': user_config})

@app.route('/get_config', methods=['GET'])
def get_config():
    """Récupérer la configuration"""
    return jsonify({'success': True, 'config': user_config})

@app.route('/export_transcript', methods=['GET'])
def export_transcript():
    """Exporter la transcription"""
    global current_text
    
    return jsonify({
        'success': True,
        'transcript': current_text,
        'history': translation_history
    })

# if __name__ == '__main__':
#     app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)