import cv2
import mediapipe as mp
import numpy as np
import os
import pickle

# --- Configuration Mediapipe ---
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

hands = mp_hands.Hands(static_image_mode=False, min_detection_confidence=0.3)

# --- Configuration du Dataset ---
DATA_DIR = './data_sign_language'
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Liste des classes (lettres) que vous voulez apprendre
# Pour l'exemple, on commence par 3 lettres pour tester rapidement
classes = ['A', 'B', 'C'] 
dataset_size = 100 # Nombre d'images par classe

cap = cv2.VideoCapture(0)

for j in range(len(classes)):
    if not os.path.exists(os.path.join(DATA_DIR, str(j))):
        os.makedirs(os.path.join(DATA_DIR, str(j)))

    print(f'Collecte des données pour la classe : {classes[j]}')

    # Attendre que l'utilisateur soit prêt
    while True:
        ret, frame = cap.read()
        cv2.putText(frame, 'Appuyez sur "Q" pour commencer !', (100, 50), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1.3, (0, 255, 0), 3, cv2.LINE_AA)
        cv2.imshow('frame', frame)
        if cv2.waitKey(25) == ord('q'):
            break

    counter = 0
    while counter < dataset_size:
        ret, frame = cap.read()
        cv2.imshow('frame', frame)
        cv2.waitKey(25)
        
        # Sauvegarde de l'image brute (on traitera les points plus tard ou à la volée)
        # Note : Pour ce script optimisé, on va extraire les points directement après
        # mais ici on sauvegarde l'image pour garder une trace visuelle si besoin.
        cv2.imwrite(os.path.join(DATA_DIR, str(j), '{}.jpg'.format(counter)), frame)

        counter += 1

cap.release()
cv2.destroyAllWindows()
print("Collecte terminée !")