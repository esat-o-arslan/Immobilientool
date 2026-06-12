# Webportal und Backend

Dieser Ordner enthält das React-Frontend und das AWS-Amplify-Gen-2-Backend.
Die vollständige Installation wird über `../setup.py` ausgeführt.

Lokale Entwicklung nach einem erfolgten Setup:

```bash
npm ci
npm run dev
```

Backend-Definitionen liegen in `amplify/`. `amplify_outputs.json` wird beim
Deployment erzeugt und darf in einem öffentlichen Fork keine produktiven
Mandantenwerte enthalten.
