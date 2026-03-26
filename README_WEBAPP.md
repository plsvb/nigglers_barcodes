# Kostenlose Barcode Scanner WebApp 🌐

Dieses Projekt wurde erweitert, um als kostenlose Web-App zu funktionieren.

## 1. Lokal starten (zum Testen)

Um die Web-App auf deinem Computer zu testen:

1. Stelle sicher, dass du die Requirements installiert hast:
   ```bash
   pip install -r requirements.txt
   ```
2. Starte die App:
   ```bash
   streamlit run streamlit_app.py
   ```
3. Dein Browser öffnet sich automatisch unter `http://localhost:8501`.

## 2. Kostenlos online stellen (Deployment)

Die einfachste Methode ist **Streamlit Community Cloud**. Das ist komplett kostenlos für öffentliche GitHub-Projekte.

### Anleitung:

1. **GitHub Repository erstellen**
   - Lade diesen Ordner (inklusive `streamlit_app.py`, `requirements.txt` und `packages.txt`) auf GitHub hoch.

2. **Bei Streamlit anmelden**
   - Gehe auf [share.streamlit.io](https://share.streamlit.io/)
   - Melde dich mit deinem GitHub-Account an.

3. **App erstellen**
   - Klicke auf "New app".
   - Wähle dein Repository aus.
   - Branch: `main` (oder `master`).
   - Main file path: `streamlit_app.py`.
   - Klicke "Deploy!".

### Wichtig für den Server (`packages.txt`)
Die Datei `packages.txt` ist extrem wichtig! Sie sagt dem Streamlit-Server, dass er die Bibliothek `libzbar0` installieren muss (Linux), damit das Barcode-Scannen funktioniert. Ohne diese Datei wird die App online mit einem "ZBar not found" Fehler abstürzen.

Viel Erfolg mit deiner WebApp! 🚀
