<h1 align="center">promantis Helpdesk</h1>
<p align="center">professionell. progressiv. proaktiv.</p>
<p align="center">
    <img src="./static/logo.svg" alt="Logo" height="80px" >
</p>

> Ticket Management System — professionelles Helpdesk- & Service-Desk-Management für interne und externe Anfragen.

## ✨ Features

- **Ticket-Erstellung**: Vollständige Ticket-Erstellung mit Markdown-Editor und Datei-Upload
- **Kundenhistorie**: Komplettes Protokoll der Kundeninteraktionen
- **Notebook**: Markdown-basiertes Notizbuch mit To-Do-Listen
- **Responsiv**: Optimiert für alle Bildschirmgrößen von Mobil bis 4K
- **Multi-Deployment**: Schnelle Bereitstellung via Docker & PM2
- **Einfach zu bedienen**: Logischer Workflow, intuitives Design

## 🐳 Installation mit Docker

```
version: "3.1"

services:
  promantis_postgres:
    container_name: promantis_postgres
    image: postgres:latest
    restart: always
    ports:
      - 5432:5432
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: promantis
      POSTGRES_PASSWORD: 1234
      POSTGRES_DB: promantis

  promantis:
    container_name: promantis
    image: ghcr.io/sgpromantis/promantis:latest
    ports:
      - 3000:3000
      - 5003:5003
    restart: always
    depends_on:
      - promantis_postgres
    environment:
      DB_USERNAME: "promantis"
      DB_PASSWORD: "1234"
      DB_HOST: "promantis_postgres"
      SECRET: 'promantis4life'

volumes:
 pgdata:

```

Standard-Anmeldedaten:

```
admin@admin.com
1234
```

## Dokumentation

Kontakt: info@promantis.de

## Lizenz

AGPL v3 — siehe [license](license) für Details.
