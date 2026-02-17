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

app = Flask(__name__)

# Chargement du modèle
try:
    model_dict = pickle.load(open('./model_sign_language.p', 'rb'))
    model = model_dict['model']
    print("Modèle chargé avec succès!")
except Exception as e:
    print(f"Erreur lors du chargement du modèle: {e}")
    model = None

# Initialisation Mediapipe
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=False, min_detection_confidence=0.3)

# Dictionnaire pour convertir l'index prédit en lettre
labels_dict = {
    0: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e', 5: 'f', 6: 'g', 7: 'h',
    8: 'i', 9: 'j', 10: 'k', 11: 'l', 12: 'm', 13: 'n', 14: 'o', 15: 'p',
    16: 'q', 17: 'r', 18: 's', 19: 't', 20: 'u', 21: 'v', 22: 'w', 23: 'x', 24: 'y', 25: 'z'
}

# Variables globales pour la session
current_text = ""
translation_history = []
detection_buffer = {}  # Pour gérer la détection avec délai

def process_frame_for_prediction(frame_rgb):
    """Traite une image pour la prédiction"""
    if model is None:
        return None
        
    data_aux = []
    x_ = []
    y_ = []
    
    results = hands.process(frame_rgb)
    
    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            # Extraction des données pour la prédiction
            for i in range(len(hand_landmarks.landmark)):
                x = hand_landmarks.landmark[i].x
                y = hand_landmarks.landmark[i].y
                x_.append(x)
                y_.append(y)
            
            # Normalisation
            for i in range(len(hand_landmarks.landmark)):
                x = hand_landmarks.landmark[i].x
                y = hand_landmarks.landmark[i].y
                data_aux.append(x - min(x_))
                data_aux.append(y - min(y_))
            
            break  # Ne traiter qu'une main pour l'instant
    
    if len(data_aux) == 42:
        prediction = model.predict([np.asarray(data_aux)])
        return labels_dict.get(int(prediction[0]), '?')
    
    return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process_frame', methods=['POST'])
def process_frame():
    """Endpoint pour traiter les frames envoyées par le client"""
    global current_text, detection_buffer
    
    try:
        data = request.get_json()
        image_data = data['image'].split(',')[1]  # Supprimer le préfixe data:image/jpeg;base64,
        image_bytes = base64.b64decode(image_data)
        
        # Convertir en image PIL puis numpy array
        image = Image.open(io.BytesIO(image_bytes))
        frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Prédiction
        predicted_char = process_frame_for_prediction(frame_rgb)
        
        current_time = time.time()
        response_data = {
            'success': True,
            'predicted_char': predicted_char,
            'current_text': current_text,
            'confirmed_char': None
        }
        
        # Gestion de la détection avec délai de confirmation
        if predicted_char:
            if predicted_char in detection_buffer:
                # Vérifier si la détection dure depuis plus de 3 secondes
                if current_time - detection_buffer[predicted_char] >= 3:
                    # Confirmer la lettre
                    if data.get('action') == 'space':
                        current_text += ' '
                        translation_history.append(' ')
                    else:
                        current_text += predicted_char
                        translation_history.append(predicted_char)
                    
                    response_data['confirmed_char'] = predicted_char
                    response_data['current_text'] = current_text
                    
                    # Réinitialiser le buffer pour cette lettre
                    del detection_buffer[predicted_char]
                else:
                    # Toujours en attente de confirmation
                    response_data['time_remaining'] = 3 - (current_time - detection_buffer[predicted_char])
            else:
                # Nouvelle détection, initialiser le timer
                detection_buffer[predicted_char] = current_time
                response_data['time_remaining'] = 3
        else:
            # Pas de main détectée, réinitialiser les buffers
            detection_buffer.clear()
        
        return jsonify(response_data)
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/update_text', methods=['POST'])
def update_text():
    """Endpoint pour gérer les actions sur le texte (espace, effacer, etc.)"""
    global current_text, translation_history, detection_buffer
    
    data = request.get_json()
    action = data.get('action')
    
    # Réinitialiser le buffer de détection
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

@app.route('/export_transcript', methods=['GET'])
def export_transcript():
    """Endpoint pour exporter la transcription"""
    global current_text
    
    return jsonify({
        'success': True,
        'transcript': current_text,
        'history': translation_history
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)